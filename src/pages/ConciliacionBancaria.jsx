import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Upload, Sparkles, Check, X, Search, Undo2 } from 'lucide-react';
import { fin } from '@/api/finanzas';
import { formatCOP, formatFecha, mensajeError, hoy } from '../components/finanzas/utils';
import { useAuth } from '@/lib/AuthContext';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const ESTADO_BADGE = { en_proceso: 'bg-blue-100 text-blue-700', conciliada: 'bg-emerald-100 text-emerald-700', con_diferencias: 'bg-amber-100 text-amber-700' };
const ESTADO_LABEL = { en_proceso: 'EN PROCESO', conciliada: 'CONCILIADA', con_diferencias: 'CON DIFERENCIAS' };
const ESTADO_LINEA_BADGE = { pendiente: 'bg-slate-100 text-slate-600', conciliada: 'bg-emerald-100 text-emerald-700', ignorada: 'bg-gray-100 text-gray-400' };

export default function ConciliacionBancaria() {
  const { user } = useAuth();
  const esAdmin = user?.role === 'admin';
  const [cuentas, setCuentas] = useState([]);
  const [conciliaciones, setConciliaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [showNueva, setShowNueva] = useState(false);
  const [detalleId, setDetalleId] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [ctas, lista] = await Promise.all([fin.get('/cuentas', { tipo: 'banco' }), fin.get('/conciliacion')]);
      setCuentas(ctas); setConciliaciones(lista);
    } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="p-4 md:p-6 max-w-full overflow-x-hidden space-y-4">
      <PageHeader title="Conciliación Bancaria" description="Compara el extracto del banco contra los movimientos del sistema."
        actionButton={<Button onClick={() => setShowNueva(true)} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" />Nueva Conciliación</Button>} />
      {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">{error}</p>}

      <Card>
        <CardHeader><CardTitle>Historial de Conciliaciones</CardTitle></CardHeader>
        <CardContent>
          {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : conciliaciones.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No hay conciliaciones registradas.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 text-xs"><th className="p-2">Cuenta</th><th className="p-2">Período</th><th className="p-2">Corte</th>
                <th className="p-2 text-right">Saldo extracto</th><th className="p-2 text-right">Saldo sistema</th><th className="p-2 text-right">Diferencia</th>
                <th className="p-2">Estado</th><th className="p-2">Acciones</th></tr></thead>
              <tbody>
                {conciliaciones.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-2">{c.cuenta_nombre}</td>
                    <td className="p-2">{MESES[c.periodo_mes - 1]} {c.periodo_anio}</td>
                    <td className="p-2">{formatFecha(c.fecha_corte)}</td>
                    <td className="p-2 text-right">{formatCOP(c.saldo_extracto)}</td>
                    <td className="p-2 text-right">{c.saldo_sistema != null ? formatCOP(c.saldo_sistema) : '—'}</td>
                    <td className={`p-2 text-right font-semibold ${c.diferencia ? 'text-red-600' : ''}`}>{c.diferencia != null ? formatCOP(c.diferencia) : '—'}</td>
                    <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[c.estado]}`}>{ESTADO_LABEL[c.estado]}</span></td>
                    <td className="p-2"><Button size="sm" variant="outline" onClick={() => setDetalleId(c.id)}>Abrir</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <NuevaConciliacionDialog open={showNueva} onClose={() => setShowNueva(false)} cuentas={cuentas}
        onCreada={(id) => { setShowNueva(false); cargar(); setDetalleId(id); }} />
      <DetalleConciliacionDialog id={detalleId} onClose={() => { setDetalleId(null); cargar(); }} esAdmin={esAdmin} />
    </div>
  );
}

function NuevaConciliacionDialog({ open, onClose, cuentas, onCreada }) {
  const [form, setForm] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const hoyF = hoy();

  useEffect(() => {
    if (open) {
      const d = new Date(`${hoyF}T00:00:00`);
      setForm({ cuenta_id: '', periodo_mes: d.getMonth() + 1, periodo_anio: d.getFullYear(), fecha_corte: hoyF, saldo_extracto: '' });
      setError('');
    }
  }, [open]);
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const crear = async (e) => {
    e.preventDefault();
    if (!form.cuenta_id) { setError('Seleccione la cuenta bancaria'); return; }
    if (form.saldo_extracto === '' || isNaN(Number(form.saldo_extracto))) { setError('Ingrese el saldo según el extracto'); return; }
    setGuardando(true); setError('');
    try {
      const c = await fin.post('/conciliacion', { ...form, saldo_extracto: Number(form.saldo_extracto) });
      onCreada(c.id);
    } catch (err) { setError(mensajeError(err)); } finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nueva Conciliación</DialogTitle></DialogHeader>
        <form onSubmit={crear} className="space-y-3 text-sm">
          <div>
            <Label>Cuenta bancaria *</Label>
            <Select value={form.cuenta_id ?? ''} onValueChange={(v) => set('cuenta_id', v)}>
              <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
              <SelectContent>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Mes *</Label>
              <Select value={String(form.periodo_mes ?? '')} onValueChange={(v) => set('periodo_mes', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Año *</Label><Input type="number" value={form.periodo_anio ?? ''} onChange={(e) => set('periodo_anio', Number(e.target.value))} /></div>
          </div>
          <div><Label>Fecha de corte *</Label><Input type="date" value={form.fecha_corte ?? ''} onChange={(e) => set('fecha_corte', e.target.value)} /></div>
          <div><Label>Saldo según extracto *</Label><Input type="number" value={form.saldo_extracto ?? ''} onChange={(e) => set('saldo_extracto', e.target.value)} /></div>
          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={guardando}>{guardando ? 'Creando…' : 'Crear'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Lee la primera hoja del archivo (Excel o CSV, ambos con la misma API) como filas crudas.
function leerHojaCruda(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const hoja = wb.Sheets[wb.SheetNames[0]];
        const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false });
        resolve(filas.filter((f) => f.some((c) => String(c ?? '').trim() !== '')));
      } catch (err) { reject(err); }
    };
    reader.readAsArrayBuffer(file);
  });
}

function aFechaISO(v) {
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(String(v))) return String(v).slice(0, 10);
  const partes = String(v).split(/[\/\-]/);
  if (partes.length === 3) {
    let [a, b, c] = partes;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    return `${c.length === 2 ? `20${c}` : c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  const d = new Date(v);
  return isNaN(d) ? '' : d.toISOString().slice(0, 10);
}

// Extracto: cada banco exporta columnas distintas. El usuario indica en un solo paso qué columna
// de su archivo es cuál; con eso alcanza para cualquier formato (no hay que programar uno por banco.
function ImportarExtractoDialog({ open, onClose, conciliacionId, onImportado }) {
  const [paso, setPaso] = useState('archivo');
  const [filas, setFilas] = useState([]);
  const [encabezados, setEncabezados] = useState([]);
  const [mapa, setMapa] = useState({ fecha: '', descripcion: '', referencia: '', valorUnico: '', debito: '', credito: '' });
  const [modoValor, setModoValor] = useState('unico');
  const [error, setError] = useState('');
  const [importando, setImportando] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => { if (open) { setPaso('archivo'); setFilas([]); setEncabezados([]); setError(''); } }, [open]);

  const onArchivo = async (file) => {
    if (!file) return;
    setError('');
    try {
      const crudas = await leerHojaCruda(file);
      if (crudas.length < 2) throw new Error('El archivo no tiene filas de datos (solo encabezado, o está vacío)');
      setEncabezados(crudas[0].map((h, i) => String(h || `Columna ${i + 1}`)));
      setFilas(crudas.slice(1));
      setMapa({ fecha: '', descripcion: '', referencia: '', valorUnico: '', debito: '', credito: '' });
      setPaso('mapear');
    } catch (e) { setError(e.message || 'No se pudo leer el archivo'); }
  };

  const lineasResultantes = () => {
    const iF = encabezados.indexOf(mapa.fecha), iD = encabezados.indexOf(mapa.descripcion), iR = encabezados.indexOf(mapa.referencia);
    if (modoValor === 'unico') {
      const iV = encabezados.indexOf(mapa.valorUnico);
      return filas.map((f) => {
        const crudo = Number(String(f[iV] ?? '0').replace(/[^0-9.,-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.'));
        return { fecha: aFechaISO(f[iF]), descripcion: f[iD], referencia: iR >= 0 ? f[iR] : '', valor: Math.abs(crudo), naturaleza: crudo < 0 ? 'salida' : 'entrada' };
      });
    }
    const iDeb = encabezados.indexOf(mapa.debito), iCre = encabezados.indexOf(mapa.credito);
    return filas.map((f) => {
      const deb = Number(String(f[iDeb] ?? '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
      const cre = Number(String(f[iCre] ?? '0').replace(/[^0-9.,-]/g, '').replace(',', '.')) || 0;
      return { fecha: aFechaISO(f[iF]), descripcion: f[iD], referencia: iR >= 0 ? f[iR] : '', valor: Math.abs(deb || cre), naturaleza: deb > 0 ? 'salida' : 'entrada' };
    });
  };

  const importar = async () => {
    if (!mapa.fecha) { setError('Indica cuál columna es la fecha'); return; }
    if (modoValor === 'unico' && !mapa.valorUnico) { setError('Indica cuál columna trae el valor'); return; }
    if (modoValor === 'doble' && !mapa.debito && !mapa.credito) { setError('Indica al menos la columna de débito o de crédito'); return; }
    const lineas = lineasResultantes().filter((l) => l.fecha && l.valor > 0);
    if (!lineas.length) { setError('Ninguna fila quedó válida con esa asignación de columnas'); return; }
    setImportando(true); setError('');
    try {
      const r = await fin.post(`/conciliacion/${conciliacionId}/importar`, { lineas });
      onImportado(r.insertadas);
    } catch (e) { setError(mensajeError(e)); } finally { setImportando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Cargar extracto (Excel o CSV)</DialogTitle></DialogHeader>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {paso === 'archivo' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">Sube el extracto tal como lo exporta el banco (.xlsx o .csv). En el siguiente paso indicas qué columna es cada dato; sirve para cualquier banco.</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onArchivo(e.target.files?.[0])} />
            <Button type="button" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4 mr-2" />Elegir archivo</Button>
          </div>
        )}
        {paso === 'mapear' && (
          <div className="space-y-3 text-sm">
            <p className="text-slate-500">{filas.length} fila(s) detectadas. Indica qué columna de tu archivo corresponde a cada dato:</p>
            <div className="grid grid-cols-2 gap-3">
              <ColSelect label="Fecha *" value={mapa.fecha} onChange={(v) => setMapa((m) => ({ ...m, fecha: v }))} encabezados={encabezados} />
              <ColSelect label="Descripción" value={mapa.descripcion} onChange={(v) => setMapa((m) => ({ ...m, descripcion: v }))} encabezados={encabezados} />
              <ColSelect label="Referencia" value={mapa.referencia} onChange={(v) => setMapa((m) => ({ ...m, referencia: v }))} encabezados={encabezados} />
            </div>
            <div>
              <Label>¿Cómo viene el valor?</Label>
              <Select value={modoValor} onValueChange={setModoValor}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unico">Una sola columna (negativo = salida)</SelectItem>
                  <SelectItem value="doble">Dos columnas: Débito y Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {modoValor === 'unico'
              ? <ColSelect label="Valor *" value={mapa.valorUnico} onChange={(v) => setMapa((m) => ({ ...m, valorUnico: v }))} encabezados={encabezados} />
              : (
                <div className="grid grid-cols-2 gap-3">
                  <ColSelect label="Débito (sale)" value={mapa.debito} onChange={(v) => setMapa((m) => ({ ...m, debito: v }))} encabezados={encabezados} />
                  <ColSelect label="Crédito (entra)" value={mapa.credito} onChange={(v) => setMapa((m) => ({ ...m, credito: v }))} encabezados={encabezados} />
                </div>
              )}
            <div className="flex justify-between pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setPaso('archivo')}>Atrás</Button>
              <Button type="button" onClick={importar} disabled={importando}>{importando ? 'Importando…' : `Importar ${filas.length} fila(s)`}</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ColSelect({ label, value, onChange, encabezados }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value || '__none'} onValueChange={(v) => onChange(v === '__none' ? '' : v)}>
        <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">— Ninguna —</SelectItem>
          {encabezados.map((h, i) => <SelectItem key={i} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function DetalleConciliacionDialog({ id, onClose, esAdmin }) {
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [showImportar, setShowImportar] = useState(false);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [buscando, setBuscando] = useState(null);

  const cargar = useCallback(async () => {
    if (!id) return;
    setCargando(true); setError('');
    try { setDetalle(await fin.get(`/conciliacion/${id}`)); } catch (e) { setError(mensajeError(e)); } finally { setCargando(false); }
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);

  const sugerir = async () => {
    setSugiriendo(true); setError('');
    try {
      const r = await fin.post(`/conciliacion/${id}/sugerir`, {});
      await cargar();
      if (r.sugeridas === 0) alert('No se encontraron nuevas coincidencias automáticas. Las líneas restantes se emparejan a mano.');
    } catch (e) { setError(mensajeError(e)); } finally { setSugiriendo(false); }
  };

  const confirmar = async (linea) => {
    try { await fin.post(`/conciliacion/${id}/lineas/${linea.id}/confirmar`, { movimiento_id: linea.movimiento_id }); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };
  const desconciliar = async (linea) => {
    try { await fin.post(`/conciliacion/${id}/lineas/${linea.id}/desconciliar`, {}); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };
  const ignorar = async (linea) => {
    const motivo = window.prompt('¿Por qué se ignora esta línea del extracto? (no corresponde a ningún movimiento del sistema)');
    if (motivo === null) return;
    try { await fin.post(`/conciliacion/${id}/lineas/${linea.id}/ignorar`, { motivo }); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };
  const cerrar = async () => {
    try { await fin.post(`/conciliacion/${id}/cerrar`, {}); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };
  const reabrir = async () => {
    const motivo = window.prompt('Motivo para reabrir esta conciliación ya cerrada:');
    if (motivo === null) return;
    try { await fin.post(`/conciliacion/${id}/reabrir`, { motivo }); cargar(); }
    catch (e) { setError(mensajeError(e)); }
  };

  if (!id) return null;
  const pendientes = detalle?.lineas?.filter((l) => l.estado === 'pendiente').length ?? 0;
  const enProceso = detalle?.estado === 'en_proceso';

  return (
    <Dialog open={!!id} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Conciliación · {detalle?.cuenta_nombre} {detalle ? `· ${MESES[detalle.periodo_mes - 1]} ${detalle.periodo_anio}` : ''}</DialogTitle></DialogHeader>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {cargando || !detalle ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-4 gap-3">
              <div className="border rounded-lg p-3"><p className="text-xs text-slate-500">Saldo extracto</p><p className="text-lg font-bold">{formatCOP(detalle.saldo_extracto)}</p></div>
              <div className="border rounded-lg p-3"><p className="text-xs text-slate-500">Saldo sistema (hoy)</p><p className="text-lg font-bold">{formatCOP(detalle.saldo_sistema_actual)}</p></div>
              <div className="border rounded-lg p-3"><p className="text-xs text-slate-500">Diferencia</p><p className={`text-lg font-bold ${Math.abs(detalle.saldo_extracto - detalle.saldo_sistema_actual) > 0.01 ? 'text-red-600' : 'text-emerald-600'}`}>{formatCOP(detalle.saldo_extracto - detalle.saldo_sistema_actual)}</p></div>
              <div className="border rounded-lg p-3"><p className="text-xs text-slate-500">Estado</p><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_BADGE[detalle.estado]}`}>{ESTADO_LABEL[detalle.estado]}</span></div>
            </div>

            {enProceso && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowImportar(true)}><Upload className="w-4 h-4 mr-1" />Cargar extracto</Button>
                <Button size="sm" variant="outline" onClick={sugerir} disabled={sugiriendo}><Sparkles className="w-4 h-4 mr-1" />{sugiriendo ? 'Buscando…' : 'Sugerir coincidencias'}</Button>
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50"><tr className="text-left"><th className="p-2">Fecha</th><th className="p-2">Descripción del extracto</th><th className="p-2 text-right">Valor</th>
                  <th className="p-2">Movimiento del sistema</th><th className="p-2">Estado</th>{enProceso && <th className="p-2">Acciones</th>}</tr></thead>
                <tbody>
                  {(detalle.lineas || []).map((l) => (
                    <tr key={l.id} className="border-t">
                      <td className="p-2">{formatFecha(l.fecha)}</td>
                      <td className="p-2">{l.descripcion}{l.referencia ? ` · ${l.referencia}` : ''}</td>
                      <td className={`p-2 text-right ${l.naturaleza === 'salida' ? 'text-red-600' : 'text-emerald-600'}`}>{l.naturaleza === 'salida' ? '−' : '+'}{formatCOP(l.valor)}</td>
                      <td className="p-2">{l.movimiento_id ? <span>{l.movimiento_concepto} <span className="text-slate-400">({formatFecha(l.movimiento_fecha)})</span></span> : <span className="text-slate-400">Sin emparejar</span>}</td>
                      <td className="p-2"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ESTADO_LINEA_BADGE[l.estado]}`}>{l.estado.toUpperCase()}</span></td>
                      {enProceso && (
                        <td className="p-2">
                          <div className="flex gap-1">
                            {l.estado === 'pendiente' && l.movimiento_id && <Button size="sm" variant="ghost" title="Confirmar" onClick={() => confirmar(l)}><Check className="w-3.5 h-3.5 text-emerald-600" /></Button>}
                            {l.estado === 'pendiente' && <Button size="sm" variant="ghost" title="Buscar manualmente" onClick={() => setBuscando(l)}><Search className="w-3.5 h-3.5" /></Button>}
                            {l.estado === 'pendiente' && <Button size="sm" variant="ghost" title="Ignorar" onClick={() => ignorar(l)}><X className="w-3.5 h-3.5 text-slate-400" /></Button>}
                            {l.estado !== 'pendiente' && <Button size="sm" variant="ghost" title="Deshacer" onClick={() => desconciliar(l)}><Undo2 className="w-3.5 h-3.5" /></Button>}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {(detalle.lineas || []).length === 0 && <tr><td colSpan={6} className="p-4 text-center text-slate-400">Aún no se ha cargado el extracto de este período.</td></tr>}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center pt-2 border-t">
              <p className="text-xs text-slate-500">{pendientes > 0 ? `${pendientes} línea(s) pendiente(s) por conciliar o ignorar` : 'Todas las líneas quedaron conciliadas o ignoradas'}</p>
              <div className="flex gap-2">
                {enProceso && <Button size="sm" onClick={cerrar} disabled={pendientes > 0}>Cerrar conciliación</Button>}
                {!enProceso && esAdmin && <Button size="sm" variant="outline" onClick={reabrir}>Reabrir</Button>}
                <Button size="sm" variant="outline" onClick={onClose}>Cerrar ventana</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
      <ImportarExtractoDialog open={showImportar} onClose={() => setShowImportar(false)} conciliacionId={id}
        onImportado={() => { setShowImportar(false); cargar(); }} />
      <BuscarMovimientoDialog linea={buscando} conciliacionId={id}
        onClose={() => setBuscando(null)} onElegido={() => { setBuscando(null); cargar(); }} />
    </Dialog>
  );
}

function BuscarMovimientoDialog({ linea, conciliacionId, onClose, onElegido }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!linea) return;
    setCargando(true); setError('');
    fin.get(`/conciliacion/${conciliacionId}/sin-conciliar`)
      .then(setMovimientos).catch((e) => setError(mensajeError(e))).finally(() => setCargando(false));
  }, [linea, conciliacionId]);

  const elegir = async (mov) => {
    try { await fin.post(`/conciliacion/${conciliacionId}/lineas/${linea.id}/confirmar`, { movimiento_id: mov.id }); onElegido(); }
    catch (e) { setError(mensajeError(e)); }
  };

  if (!linea) return null;
  return (
    <Dialog open={!!linea} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Buscar movimiento para "{linea.descripcion}"</DialogTitle></DialogHeader>
        <p className="text-xs text-slate-500">Línea del extracto: {formatFecha(linea.fecha)} · {linea.naturaleza === 'salida' ? '−' : '+'}{formatCOP(linea.valor)}</p>
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>}
        {cargando ? <p className="text-sm text-slate-400">Cargando…</p> : (
          <table className="w-full text-xs border rounded">
            <tbody>
              {movimientos.map((m) => (
                <tr key={m.id} className="border-t hover:bg-slate-50 cursor-pointer" onClick={() => elegir(m)}>
                  <td className="p-2">{formatFecha(m.fecha)}</td>
                  <td className="p-2">{m.concepto}{m.tercero_nombre ? ` · ${m.tercero_nombre}` : ''}</td>
                  <td className={`p-2 text-right ${m.naturaleza === 'salida' ? 'text-red-600' : 'text-emerald-600'}`}>{m.naturaleza === 'salida' ? '−' : '+'}{formatCOP(m.valor)}</td>
                </tr>
              ))}
              {movimientos.length === 0 && <tr><td className="p-4 text-center text-slate-400">No hay movimientos sin conciliar en esta cuenta.</td></tr>}
            </tbody>
          </table>
        )}
      </DialogContent>
    </Dialog>
  );
}
