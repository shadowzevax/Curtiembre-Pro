import React, { useEffect, useState, useCallback } from 'react';
import PageHeader from '../common/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, DollarSign, FileText, Ban, History } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { anularOperacionFinanciera } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, ESTADO_OBLIGACION } from './utils';
import { CobroPagoDialog, NotaDialog, AnticipoDialog, CruceAnticipoDialog } from './CarteraDialogs';
import { useAuth } from '@/lib/AuthContext';
import BarraExportar, { textoFiltros } from './BarraExportar';
import DocumentoFinancieroDialog from './DocumentoFinancieroDialog';

const ORIGEN_VENTA = { productos: 'Venta de productos', servicios: 'Venta de servicios' };
const TIPO_MOV_ANTICIPO = { cruce_anticipo: 'Aplicación a factura', reversa: 'Reversa (anulación)', devolucion: 'Devolución', nota_credito: 'Nota crédito', nota_debito: 'Nota débito' };
const estadoAnticipo = (a) => (a.saldo <= 0.004 ? 'Aplicado totalmente' : a.aplicado > 0 ? 'Aplicado parcialmente' : 'Disponible');
const esAnticipo = (o) => o?.naturaleza === 'anticipo_cliente' || o?.naturaleza === 'anticipo_proveedor';

// Módulo genérico de Cuentas por Cobrar / Cuentas por Pagar: cartera, cobro/pago, notas,
// anticipos y su cruce. naturaleza: 'por_cobrar' | 'por_pagar'.
export default function CarteraModulo({ naturaleza, titulo, descripcion, etiquetaTercero }) {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const esCxc = naturaleza === 'por_cobrar';
  const [obligaciones, setObligaciones] = useState([]);
  const [anticipos, setAnticipos] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [filtroEstado, setFiltroEstado] = useState('__todas__');
  const [busqueda, setBusqueda] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [seleccionada, setSeleccionada] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [vistaAnticipos, setVistaAnticipos] = useState(false);
  const [documentoAbierto, setDocumentoAbierto] = useState(null);
  const [filtroOrigen, setFiltroOrigen] = useState('__todos__');
  const [vistaMovAnticipos, setVistaMovAnticipos] = useState(false);
  const [movAnticipos, setMovAnticipos] = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [obls, ants, cts] = await Promise.all([
        fin.get('/obligaciones', { naturaleza }),
        fin.get('/obligaciones', { naturaleza: esCxc ? 'anticipo_cliente' : 'anticipo_proveedor' }),
        fin.get('/cuentas'),
      ]);
      setObligaciones(obls); setAnticipos(ants); setCuentas(cts);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [naturaleza, esCxc]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    if (!vistaAnticipos || !vistaMovAnticipos) return;
    fin.get('/anticipos/movimientos', { naturaleza: esCxc ? 'anticipo_cliente' : 'anticipo_proveedor' })
      .then(setMovAnticipos).catch((e) => setError(mensajeError(e)));
  }, [vistaAnticipos, vistaMovAnticipos, esCxc, anticipos]);

  // Desde el historial del anticipo se abre la factura y viceversa (trazabilidad en ambos sentidos).
  const abrirPorId = (id) => {
    const o = [...obligaciones, ...anticipos].find((x) => x.id === id);
    if (o) abrirDetalle(o); else fin.get(`/obligaciones/${id}`).then((d) => { setSeleccionada(d); setDetalle(d); }).catch((e) => setError(mensajeError(e)));
  };

  const abrirDetalle = async (o) => {
    setSeleccionada(o); setDetalle(null);
    try { setDetalle(await fin.get(`/obligaciones/${o.id}`)); } catch (e) { setError(mensajeError(e)); }
  };

  const filtradas = obligaciones.filter((o) =>
    (filtroEstado === '__todas__' || o.estado === filtroEstado) && (!desde || o.fecha >= desde) && (!hasta || o.fecha <= hasta) &&
    (filtroOrigen === '__todos__' || o.origen_venta === filtroOrigen) &&
    (!busqueda || `${o.tercero_nombre} ${o.documento_numero} ${o.numero_interno || ''}`.toLowerCase().includes(busqueda.toLowerCase())));
  const totalPendiente = filtradas.filter((o) => o.estado !== 'anulada' && o.estado !== 'pagada').reduce((s, o) => s + o.saldo, 0);
  const totalVencido = filtradas.filter((o) => o.estado === 'vencida').reduce((s, o) => s + o.saldo, 0);

  const anticiposFiltrados = anticipos.filter((a) => (!busqueda || a.tercero_nombre?.toLowerCase().includes(busqueda.toLowerCase()))
    && (!desde || a.fecha >= desde) && (!hasta || a.fecha <= hasta));
  const movAnticiposFiltrados = movAnticipos.filter((m) => (!busqueda || `${m.tercero_nombre} ${m.recibo} ${m.factura || ''}`.toLowerCase().includes(busqueda.toLowerCase()))
    && (!desde || m.fecha >= desde) && (!hasta || m.fecha <= hasta));

  // Exportar / imprimir exactamente la vista y los filtros actuales.
  const filtrosTexto = textoFiltros([['Búsqueda', busqueda], ['Desde', desde && formatFecha(desde)], ['Hasta', hasta && formatFecha(hasta)],
    ['Estado', !vistaAnticipos && filtroEstado !== '__todas__' && ESTADO_OBLIGACION[filtroEstado]?.label],
    ['Origen', !vistaAnticipos && filtroOrigen !== '__todos__' && ORIGEN_VENTA[filtroOrigen]]]);
  const exportacion = vistaAnticipos && vistaMovAnticipos ? {
    titulo: `Movimientos de anticipos ${esCxc ? 'de clientes' : 'a proveedores'}`,
    columnas: [{ key: 'fecha', label: 'Fecha', render: formatFecha }, { key: 'recibo', label: 'Recibo anticipo' },
      { key: 'tercero_nombre', label: etiquetaTercero, ancho: 2 }, { key: 'tipo', label: 'Movimiento', render: (v) => TIPO_MOV_ANTICIPO[v] || v },
      { key: 'factura', label: 'Factura aplicada', render: (v) => v || '—' }, { key: 'documento_cruce', label: 'Doc. cruce', render: (v) => v || '—' },
      { key: 'valor', label: 'Valor aplicado', align: 'right', render: formatCOP }, { key: 'saldo_despues', label: 'Saldo anticipo', align: 'right', render: formatCOP }],
    filas: movAnticiposFiltrados,
    totales: { valor: movAnticiposFiltrados.reduce((x, m) => x + m.valor, 0) },
  } : vistaAnticipos ? {
    titulo: `Anticipos ${esCxc ? 'de clientes' : 'a proveedores'}`,
    columnas: [{ key: 'documento_numero', label: 'Recibo' }, { key: 'tercero_nombre', label: etiquetaTercero, ancho: 2 },
      { key: 'fecha', label: 'Fecha', render: formatFecha }, { key: 'valor_original', label: 'Valor recibido', align: 'right', render: formatCOP },
      { key: 'aplicado', label: 'Aplicado', align: 'right', render: formatCOP },
      { key: 'saldo', label: 'Disponible', align: 'right', render: formatCOP }, { key: 'estado_txt', label: 'Estado' }],
    filas: anticiposFiltrados.map((a) => ({ ...a, estado_txt: estadoAnticipo(a) })),
    filas: anticiposFiltrados,
    totales: { valor_original: anticiposFiltrados.reduce((x, a) => x + a.valor_original, 0), saldo: anticiposFiltrados.reduce((x, a) => x + a.saldo, 0) },
  } : {
    titulo: `Relación de ${titulo}`,
    columnas: [{ key: 'documento_numero', label: 'Documento' }, { key: 'tercero_nombre', label: etiquetaTercero, ancho: 2 },
      { key: 'fecha', label: 'Fecha', render: formatFecha }, { key: 'fecha_vencimiento', label: 'Vence', render: formatFecha },
      { key: 'valor_original', label: 'Total', align: 'right', render: formatCOP }, { key: 'aplicado', label: esCxc ? 'Abonado' : 'Pagado', align: 'right', render: formatCOP },
      { key: 'saldo', label: 'Saldo', align: 'right', render: formatCOP }, { key: 'estado', label: 'Estado', render: (v) => ESTADO_OBLIGACION[v]?.label || v },
      { key: 'dias_vencida', label: 'Días venc.', align: 'right', render: (v) => (v ? String(v) : '') }],
    filas: filtradas,
    totales: { valor_original: filtradas.filter((o) => o.estado !== 'anulada').reduce((x, o) => x + o.valor_original, 0),
      aplicado: filtradas.filter((o) => o.estado !== 'anulada').reduce((x, o) => x + o.aplicado, 0),
      saldo: filtradas.filter((o) => o.estado !== 'anulada').reduce((x, o) => x + o.saldo, 0) },
  };

  return (
    <div className="p-6">
      <PageHeader title={titulo} description={descripcion} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="border rounded-lg p-3 bg-slate-50"><p className="text-xs text-slate-500">Total pendiente (filtro actual)</p><p className="text-xl font-bold">{formatCOP(totalPendiente)}</p></div>
        <div className="border rounded-lg p-3 bg-red-50"><p className="text-xs text-red-600">Vencido</p><p className="text-xl font-bold text-red-700">{formatCOP(totalVencido)}</p></div>
        <div className="border rounded-lg p-3 bg-blue-50"><p className="text-xs text-blue-600">Anticipos disponibles</p><p className="text-xl font-bold text-blue-700">{formatCOP(anticipos.reduce((s, a) => s + a.saldo, 0))}</p></div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-2">
          <Button size="sm" variant={!vistaAnticipos ? 'default' : 'outline'} onClick={() => setVistaAnticipos(false)}>Cartera</Button>
          <Button size="sm" variant={vistaAnticipos ? 'default' : 'outline'} onClick={() => setVistaAnticipos(true)}>Anticipos ({anticipos.length})</Button>
          {vistaAnticipos && (
            <Button size="sm" variant="outline" onClick={() => setVistaMovAnticipos((v) => !v)}>
              {vistaMovAnticipos ? 'Ver lista de anticipos' : 'Ver movimientos (historial de aplicaciones)'}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Input placeholder={`Buscar ${etiquetaTercero.toLowerCase()} o documento…`} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-56" />
          {!vistaAnticipos && (
            <Select value={filtroEstado} onValueChange={setFiltroEstado}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todas__">Todos los estados</SelectItem>
                {Object.entries(ESTADO_OBLIGACION).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {!vistaAnticipos && esCxc && (
            <Select value={filtroOrigen} onValueChange={setFiltroOrigen}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos__">Todos los orígenes</SelectItem>
                {Object.entries(ORIGEN_VENTA).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Input type="date" title="Desde" value={desde} onChange={(e) => setDesde(e.target.value)} className="w-36" />
          <Input type="date" title="Hasta" value={hasta} onChange={(e) => setHasta(e.target.value)} className="w-36" />
          {vistaAnticipos && <Button size="sm" onClick={() => setDialogo('anticipo')}><Plus className="w-4 h-4 mr-1" />Nuevo anticipo</Button>}
        </div>
      </div>
      <BarraExportar className="mb-3 justify-end" filtrosTexto={filtrosTexto} {...exportacion} />

      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3 mb-3">{error}</p>}

      {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : vistaAnticipos && vistaMovAnticipos ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500"><th className="p-2">Fecha</th><th className="p-2">Recibo anticipo</th>
              <th className="p-2">{etiquetaTercero}</th><th className="p-2">Movimiento</th><th className="p-2">Factura aplicada</th>
              <th className="p-2 text-right">Valor aplicado</th><th className="p-2 text-right">Saldo anticipo</th></tr></thead>
            <tbody>
              {movAnticiposFiltrados.map((m) => (
                <tr key={m.id} className="border-t">
                  <td className="p-2">{formatFecha(m.fecha)}</td>
                  <td className="p-2 font-mono"><button type="button" className="text-blue-700 underline" onClick={() => abrirPorId(m.anticipo_id)}>{m.recibo}</button></td>
                  <td className="p-2">{m.tercero_nombre}</td><td className="p-2">{TIPO_MOV_ANTICIPO[m.tipo] || m.tipo}</td>
                  <td className="p-2 font-mono">{m.factura_id ? <button type="button" className="text-blue-700 underline" onClick={() => abrirPorId(m.factura_id)}>{m.factura}</button> : '—'}</td>
                  <td className="p-2 text-right">{formatCOP(m.valor)}</td><td className="p-2 text-right font-semibold">{formatCOP(m.saldo_despues)}</td>
                </tr>
              ))}
              {movAnticiposFiltrados.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin aplicaciones de anticipos en este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : vistaAnticipos ? (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500"><th className="p-2">Recibo</th><th className="p-2">{etiquetaTercero}</th><th className="p-2">Fecha</th>
              <th className="p-2 text-right">Valor recibido</th><th className="p-2 text-right">Aplicado</th><th className="p-2 text-right">Disponible</th><th className="p-2 text-center">Estado</th><th className="p-2"></th></tr></thead>
            <tbody>
              {anticiposFiltrados.map((a) => (
                <tr key={a.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => abrirDetalle(a)}>
                  <td className="p-2 font-mono">{a.documento_numero}</td><td className="p-2">{a.tercero_nombre}</td>
                  <td className="p-2">{formatFecha(a.fecha)}</td><td className="p-2 text-right">{formatCOP(a.valor_original)}</td>
                  <td className="p-2 text-right">{formatCOP(a.aplicado)}</td>
                  <td className="p-2 text-right font-semibold">{formatCOP(a.saldo)}</td>
                  <td className="p-2 text-center"><Badge className={a.saldo <= 0.004 ? 'bg-slate-200 text-slate-700' : a.aplicado > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}>{estadoAnticipo(a)}</Badge></td>
                  <td className="p-2 text-right"><Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); abrirDetalle(a); }}><History className="w-3.5 h-3.5 mr-1" />Historial</Button></td>
                </tr>
              ))}
              {anticiposFiltrados.length === 0 && <tr><td colSpan={8} className="p-4 text-center text-slate-400">Sin anticipos.</td></tr>}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-xs text-slate-500">
              <th className="p-2">Documento</th><th className="p-2">{etiquetaTercero}</th><th className="p-2">Vence</th>
              <th className="p-2 text-right">Total</th><th className="p-2 text-right">Saldo</th><th className="p-2 text-center">Estado</th><th className="p-2"></th>
            </tr></thead>
            <tbody>
              {filtradas.map((o) => {
                const est = ESTADO_OBLIGACION[o.estado] || ESTADO_OBLIGACION.pendiente;
                return (
                  <tr key={o.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => abrirDetalle(o)}>
                    <td className="p-2"><div className="font-mono">{o.documento_numero}</div>
                      {(o.numero_interno && o.numero_interno !== o.documento_numero) || o.origen_venta ? (
                        <div className="text-[11px] text-slate-400">{[o.numero_interno && o.numero_interno !== o.documento_numero && `Interno ${o.numero_interno}`, ORIGEN_VENTA[o.origen_venta]].filter(Boolean).join(' · ')}</div>
                      ) : null}</td>
                    <td className="p-2">{o.tercero_nombre}</td>
                    <td className="p-2">{formatFecha(o.fecha_vencimiento)}{o.estado === 'vencida' && <span className="text-red-600 text-xs ml-1">({o.dias_vencida}d)</span>}</td>
                    <td className="p-2 text-right">{formatCOP(o.valor_original)}</td>
                    <td className="p-2 text-right font-semibold">{formatCOP(o.saldo)}</td>
                    <td className="p-2 text-center"><Badge className={est.clase}>{est.label}</Badge></td>
                    <td className="p-2 text-right">
                      {o.estado !== 'pagada' && o.estado !== 'anulada' && (
                        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); abrirDetalle(o); setDialogo('cobro'); }}>
                          <DollarSign className="w-3.5 h-3.5 mr-1" />{esCxc ? 'Cobrar' : 'Pagar'}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtradas.length === 0 && <tr><td colSpan={7} className="p-4 text-center text-slate-400">Sin cuentas en este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalle: historial de aplicaciones (abonos, notas, retenciones) */}
      <Dialog open={!!seleccionada && !dialogo} onOpenChange={() => setSeleccionada(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{esAnticipo(seleccionada) ? 'Historial del anticipo ' : ''}{seleccionada?.documento_numero} · {seleccionada?.tercero_nombre}</DialogTitle></DialogHeader>
          {detalle && (
            <div className="space-y-3 text-sm">
              {esAnticipo(detalle) ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 bg-blue-50 rounded p-2 text-xs">
                  <div>Recibo original: <button type="button" className="font-mono text-blue-700 underline" onClick={() => setDocumentoAbierto(detalle.documento_numero)}>{detalle.documento_numero}</button></div>
                  <div>{etiquetaTercero}: <strong>{detalle.tercero_nombre}</strong></div>
                  <div>Recibido el: <strong>{formatFecha(detalle.fecha)}</strong></div>
                  <div>Valor recibido: <strong>{formatCOP(detalle.valor_original)}</strong></div>
                  <div>Aplicado a facturas: <strong>{formatCOP(detalle.aplicado)}</strong></div>
                  <div>Saldo disponible: <strong>{formatCOP(detalle.saldo)}</strong> · <Badge>{estadoAnticipo(detalle)}</Badge></div>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded p-2 text-xs">
                  <div>Total: <strong>{formatCOP(detalle.valor_original)}</strong></div>
                  <div>Aplicado: <strong>{formatCOP(detalle.aplicado)}</strong></div>
                  <div>Saldo: <strong>{formatCOP(detalle.saldo)}</strong></div>
                </div>
              )}
              {esAnticipo(detalle) && <p className="text-[11px] text-slate-500">Cada cruce se aplica a la factura sin generar un nuevo ingreso de dinero: el dinero entró con el recibo original.</p>}
              {detalle.documento_modulo && (
                <p className="text-xs text-slate-500">Documento de origen: {detalle.documento_modulo === 'OrdenVenta' ? (ORIGEN_VENTA[detalle.origen_venta] || 'Venta') : detalle.documento_modulo === 'OrdenCompra' ? 'Compra' : esAnticipo(detalle) ? 'Recibo de anticipo' : detalle.documento_modulo}
                  {detalle.numero_interno && detalle.numero_interno !== detalle.documento_numero ? ` · Consecutivo interno ${detalle.numero_interno}` : ''}</p>
              )}
              <table className="w-full text-xs border rounded">
                <thead className="bg-slate-100"><tr><th className="p-1.5 text-left">Fecha</th><th className="p-1.5 text-left">Tipo</th><th className="p-1.5 text-left">Documento</th>
                  <th className="p-1.5 text-left">{esAnticipo(detalle) ? 'Factura aplicada' : 'Anticipo usado'}</th><th className="p-1.5 text-right">Valor</th>
                  <th className="p-1.5 text-right">Saldo después</th><th className="p-1.5"></th></tr></thead>
                <tbody>
                  {detalle.aplicaciones.map((a) => (
                    <tr key={a.id} className="border-t">
                      <td className="p-1.5">{formatFecha(a.fecha)}</td><td className="p-1.5 capitalize">{a.tipo.replace(/_/g, ' ')}</td>
                      <td className="p-1.5 font-mono">{a.documento_numero
                        ? <button type="button" className="text-blue-700 underline" title="Ver / Imprimir / PDF" onClick={() => setDocumentoAbierto(a.documento_numero)}>{a.documento_numero}</button>
                        : '—'}</td>
                      <td className="p-1.5 font-mono">{a.contraparte_id
                        ? <button type="button" className="text-blue-700 underline" title="Abrir" onClick={() => abrirPorId(a.contraparte_id)}>{a.contraparte_numero}</button>
                        : '—'}</td>
                      <td className="p-1.5 text-right">{formatCOP(a.valor)}</td><td className="p-1.5 text-right">{formatCOP(a.saldo_despues)}</td>
                      <td className="p-1.5 text-right">{esAdmin && a.tipo !== 'reversa' && (
                        <button title="Anular" onClick={async () => { if (await anularOperacionFinanciera(a.operacion_id, `${a.tipo} de ${formatCOP(a.valor)}`)) { cargar(); abrirDetalle(seleccionada); } }}>
                          <Ban className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}</td>
                    </tr>
                  ))}
                  {detalle.aplicaciones.length === 0 && <tr><td colSpan={7} className="p-3 text-center text-slate-400">Sin abonos ni notas todavía.</td></tr>}
                </tbody>
              </table>
              {esAnticipo(detalle) && (
                <BarraExportar className="justify-end" titulo={`Historial del anticipo ${detalle.documento_numero}`}
                  filtrosTexto={textoFiltros([[etiquetaTercero, detalle.tercero_nombre], ['Recibido', formatFecha(detalle.fecha)], ['Valor recibido', formatCOP(detalle.valor_original)],
                    ['Saldo disponible', formatCOP(detalle.saldo)], ['Estado', estadoAnticipo(detalle)]])}
                  filas={detalle.aplicaciones}
                  columnas={[{ key: 'fecha', label: 'Fecha', render: formatFecha }, { key: 'tipo', label: 'Movimiento', render: (v) => TIPO_MOV_ANTICIPO[v] || v },
                    { key: 'documento_numero', label: 'Doc. cruce', render: (v) => v || '—' }, { key: 'contraparte_numero', label: 'Factura aplicada', render: (v) => v || '—' },
                    { key: 'valor', label: 'Valor aplicado', align: 'right', render: formatCOP }, { key: 'saldo_despues', label: 'Saldo anticipo', align: 'right', render: formatCOP }]} />
              )}
              <div className="flex justify-end gap-2 pt-2 border-t">
                {!esAnticipo(detalle) && detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && anticipos.some((x) => x.saldo > 0.004) && (
                  <Button size="sm" variant="outline" onClick={() => setDialogo('cruce')}>Cruzar anticipo</Button>
                )}
                {!esAnticipo(detalle) && detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && <Button size="sm" variant="outline" onClick={() => setDialogo('nota')}><FileText className="w-4 h-4 mr-1" />Nota crédito/débito</Button>}
                {!esAnticipo(detalle) && detalle.estado !== 'pagada' && detalle.estado !== 'anulada' && <Button size="sm" onClick={() => setDialogo('cobro')}>{esCxc ? 'Cobrar' : 'Pagar'}</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <CobroPagoDialog open={dialogo === 'cobro'} onClose={() => setDialogo(null)} obligacion={seleccionada} cuentas={cuentas}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <NotaDialog open={dialogo === 'nota'} onClose={() => setDialogo(null)} obligacion={seleccionada}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <CruceAnticipoDialog open={dialogo === 'cruce'} onClose={() => setDialogo(null)} obligacion={seleccionada} anticipos={anticipos}
        onGuardado={() => { cargar(); if (seleccionada) abrirDetalle(seleccionada); }} />
      <AnticipoDialog open={dialogo === 'anticipo'} onClose={() => setDialogo(null)} naturaleza={naturaleza} cuentas={cuentas} onGuardado={cargar} />
      <DocumentoFinancieroDialog numero={documentoAbierto} onClose={() => setDocumentoAbierto(null)} />
    </div>
  );
}
