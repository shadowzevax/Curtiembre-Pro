import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ProcesoProduccion } from '@/entities/all';
import { Loader2, Save, Plus, Trash2 } from 'lucide-react';
import { SeccionProductosQuimicos, SeccionRecurtidoPorColor } from './TablaCostosSecciones';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatNumber = (num) => parseFloat(num || 0).toFixed(2);

export default function LoteDetalleConsolidado({ open, onOpenChange, codigoLote }) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loteData, setLoteData] = useState(null);
  const [procesos, setProcesos] = useState({
    recepcion: null,
    remojo: [],
    pelambre: [],
    curtido: [],
    recurtido: []
  });
  
  // Costos manuales
  const [serviciosMaquinaria, setServiciosMaquinaria] = useState([]);
  const [serviciosManoObra, setServiciosManoObra] = useState([]);
  const [otrosCostos, setOtrosCostos] = useState([]);
  const [otrosConceptos, setOtrosConceptos] = useState([]);

  useEffect(() => {
    if (open && codigoLote) {
      loadLoteDetails();
    }
  }, [open, codigoLote]);

  const loadLoteDetails = async () => {
    setLoading(true);
    try {
      const [recepcion, limpieza, curtido, recurtido] = await Promise.all([
        ProcesoProduccion.filter({ codigo_lote: codigoLote, tipo_proceso: 'recepcion' }),
        ProcesoProduccion.filter({ codigo_lote: codigoLote, tipo_proceso: 'limpieza' }),
        ProcesoProduccion.filter({ codigo_lote: codigoLote, tipo_proceso: 'curtido' }),
        ProcesoProduccion.filter({ codigo_lote: codigoLote, tipo_proceso: 'recurtido' })
      ]);
      
      const remojo = limpieza.filter(p => p.seccion === 'remojo');
      const pelambre = limpieza.filter(p => p.seccion === 'pelambre');
      
      setProcesos({
        recepcion: recepcion[0] || null,
        remojo,
        pelambre,
        curtido,
        recurtido
      });
      
      setLoteData(recepcion[0]);
      
      // Cargar costos manuales si existen
      if (recepcion[0]) {
        setServiciosMaquinaria(recepcion[0].servicios_maquinaria || []);
        setServiciosManoObra(recepcion[0].servicios_mano_obra || []);
        setOtrosCostos(recepcion[0].otros_costos || []);
        setOtrosConceptos(recepcion[0].otros_conceptos || [
          { concepto: 'CARNAZA QUE DEJA EN KILOS', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTOS NETOS', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTO DE CROSTA POR HOJA', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'PROMEDIO DE MEDIDA PIES/HOJA', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTO DE CROSTA POR PIE', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTO DE PINTURA TERMINADA/HOJA', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTO DE UNA HOJA YA TERMINADA', cantidad: 0, valor: 0, valor_total: 0 },
          { concepto: 'COSTO DEL PIE TERMINADO', cantidad: 0, valor: 0, valor_total: 0 }
        ]);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calcular subtotales
  const calcularSubtotalInsumos = (items) => {
    return items.reduce((sum, item) => {
      if (item.insumos_utilizados && Array.isArray(item.insumos_utilizados)) {
        return sum + item.insumos_utilizados.reduce((s, ins) => s + (ins.valor_total || 0), 0);
      }
      return sum;
    }, 0);
  };

  const subtotalRemojo = calcularSubtotalInsumos(procesos.remojo);
  const subtotalPelambre = calcularSubtotalInsumos(procesos.pelambre);
  const subtotalCurtido = calcularSubtotalInsumos(procesos.curtido);
  
  // Recurtido por color
  const recurtidoPorColor = procesos.recurtido.reduce((acc, proc) => {
    const color = proc.nombre_color || proc.codigo_color || 'SIN_COLOR';
    if (!acc[color]) acc[color] = [];
    acc[color].push(proc);
    return acc;
  }, {});
  
  const subtotalesRecurtido = Object.keys(recurtidoPorColor).map(color => ({
    color,
    items: recurtidoPorColor[color],
    subtotal: calcularSubtotalInsumos(recurtidoPorColor[color])
  }));
  
  const subtotalRecurtidoTotal = subtotalesRecurtido.reduce((sum, r) => sum + r.subtotal, 0);

  // Calcular costos manuales
  const subtotalMaquinaria = serviciosMaquinaria.reduce((sum, s) => sum + ((s.cantidad_pieles || 0) * (s.valor_unitario || 0)), 0);
  const subtotalManoObra = serviciosManoObra.reduce((sum, s) => sum + ((s.cantidad || 0) * (s.valor || 0)), 0);
  const subtotalOtros = otrosCostos.reduce((sum, c) => sum + ((c.cantidad || 0) * (c.valor || 0)), 0);

  const totalCostoProceso = subtotalRemojo + subtotalPelambre + subtotalCurtido + subtotalRecurtidoTotal;
  const sumasTotalLote = totalCostoProceso + subtotalMaquinaria + subtotalManoObra + subtotalOtros;
  
  // Calcular valores de "Otros Conceptos" automáticamente
  const calcularOtrosConceptos = () => {
    const updated = [...otrosConceptos];
    
    // 1. CARNAZA QUE DEJA EN KILOS (manual)
    updated[0].valor_total = (updated[0].cantidad || 0) * (updated[0].valor || 0);
    
    // 2. COSTOS NETOS = SUMAS TOTAL LOTE - CARNAZA
    updated[1].valor_total = sumasTotalLote - updated[0].valor_total;
    
    // 3. COSTO DE CROSTA POR HOJA = COSTOS NETOS / CANTIDAD TOTAL HOJAS
    const cantHojas = loteData?.cantidad_total_lote_hojas || 1;
    updated[2].valor_total = updated[1].valor_total / cantHojas;
    
    // 4. PROMEDIO DE MEDIDA PIES/HOJA (manual - valor)
    
    // 5. COSTO DE CROSTA POR PIE = COSTO DE CROSTA POR HOJA / PROMEDIO PIES/HOJA
    const promPies = updated[3].valor || 1;
    updated[4].valor_total = updated[2].valor_total / promPies;
    
    // 6. COSTO DE PINTURA TERMINADA/HOJA (manual - valor)
    
    // 7. COSTO DE UNA HOJA YA TERMINADA = COSTO DE CROSTA POR HOJA + COSTO DE PINTURA/HOJA
    updated[6].valor_total = updated[2].valor_total + (updated[5].valor || 0);
    
    // 8. COSTO DEL PIE TERMINADO = COSTO HOJA TERMINADA / PROMEDIO PIES/HOJA
    updated[7].valor_total = updated[6].valor_total / promPies;
    
    return updated;
  };
  
  const otrosConceptosCalculados = calcularOtrosConceptos();
  const totalGeneral = sumasTotalLote;

  // Funciones para manejar costos manuales
  const agregarServicioMaquinaria = () => {
    setServiciosMaquinaria([...serviciosMaquinaria, { nombre_servicio: '', cantidad_pieles: 0, valor_unitario: 0 }]);
  };
  
  const agregarServicioManoObra = () => {
    setServiciosManoObra([...serviciosManoObra, { nombre_servicio: '', cantidad: 0, valor: 0 }]);
  };
  
  const agregarOtroCosto = () => {
    setOtrosCostos([...otrosCostos, { descripcion: '', cantidad: 0, valor: 0 }]);
  };

  const guardarCostosManuales = async () => {
    setSaving(true);
    try {
      if (procesos.recepcion?.id) {
        await ProcesoProduccion.update(procesos.recepcion.id, {
          servicios_maquinaria: serviciosMaquinaria,
          servicios_mano_obra: serviciosManoObra,
          otros_costos: otrosCostos,
          otros_conceptos: otrosConceptosCalculados
        });
        alert('Costos guardados exitosamente');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!loteData) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] max-h-[98vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">TABLA DE COSTOS POR LOTE - {codigoLote}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="space-y-3 text-xs">
            {/* ENCABEZADO */}
            <div className="bg-blue-50 border-2 border-blue-300 rounded p-3">
              <div className="grid grid-cols-4 gap-2">
                <div><strong>CODIGO LOTE:</strong> {codigoLote}</div>
                <div><strong>PROVEEDOR:</strong> {loteData.proveedor_id || 'N/A'}</div>
                <div><strong>NO. DOCUMENTO:</strong> {loteData.no_documento || 'N/A'}</div>
                <div><strong>FECHA RECEPCIÓN:</strong> {loteData.fecha_inicio ? new Date(loteData.fecha_inicio).toLocaleDateString('es-CO') : 'N/A'}</div>
                <div><strong>CANT. TOTAL PIELES:</strong> {loteData.cantidad_pieles || 0}</div>
                <div><strong>CANT. TOTAL HOJAS:</strong> {loteData.cantidad_total_lote_hojas || 0}</div>
                <div><strong>PESO TOTAL (KG):</strong> {formatNumber(loteData.peso_total || 0)}</div>
                <div><strong>PESO PROMEDIO PIEL:</strong> {formatNumber((loteData.peso_total || 0) / (loteData.cantidad_pieles || 1))}</div>
              </div>
            </div>

            {/* SECCIONES AUTOMÁTICAS */}
            <SeccionProductosQuimicos titulo="REMOJO" items={procesos.remojo} peso={loteData.peso_total || 0} />
            <SeccionProductosQuimicos titulo="PELAMBRE" items={procesos.pelambre} peso={loteData.peso_total || 0} />
            <SeccionProductosQuimicos titulo="CURTIDO" items={procesos.curtido} peso={loteData.peso_total || 0} />
            
            {/* RECURTIDO POR COLOR */}
            {subtotalesRecurtido.length > 0 && (
              <div className="space-y-2">
                <div className="bg-purple-700 text-white px-3 py-2 font-bold text-center">RECURTIDO</div>
                {subtotalesRecurtido.map(({ color, items }) => (
                  <SeccionRecurtidoPorColor key={color} color={color} items={items} peso={loteData.peso_total || 0} />
                ))}
              </div>
            )}

            {/* TOTAL COSTO PROCESO */}
            <div className="bg-yellow-300 border-2 border-yellow-500 p-2 font-bold text-right text-base">
              TOTAL COSTO PROCESO CUERO: {formatCurrency(totalCostoProceso)}
            </div>
            
            {/* SUMAS TOTAL LOTE */}
            <div className="bg-orange-300 border-2 border-orange-500 p-2 font-bold text-right text-base">
              SUMAS TOTAL LOTE: {formatCurrency(sumasTotalLote)}
            </div>

            {/* SERVICIO DE MAQUINARIA */}
            <div className="border rounded">
              <div className="bg-orange-600 text-white px-3 py-2 font-bold flex justify-between items-center">
                <span>SERVICIO DE MAQUINARIA</span>
                <Button size="sm" variant="secondary" onClick={agregarServicioMaquinaria}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border p-1">NOMBRE DEL SERVICIO</th>
                    <th className="border p-1">CANTIDAD EN PIELES</th>
                    <th className="border p-1">VALOR UNITARIO</th>
                    <th className="border p-1">VALOR TOTAL</th>
                    <th className="border p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosMaquinaria.map((s, idx) => (
                    <tr key={idx}>
                      <td className="border p-1"><Input className="h-7 text-xs" value={s.nombre_servicio} onChange={e => {
                        const u = [...serviciosMaquinaria];
                        u[idx].nombre_servicio = e.target.value;
                        setServiciosMaquinaria(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={s.cantidad_pieles} onChange={e => {
                        const u = [...serviciosMaquinaria];
                        u[idx].cantidad_pieles = parseFloat(e.target.value) || 0;
                        setServiciosMaquinaria(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={s.valor_unitario} onChange={e => {
                        const u = [...serviciosMaquinaria];
                        u[idx].valor_unitario = parseFloat(e.target.value) || 0;
                        setServiciosMaquinaria(u);
                      }} /></td>
                      <td className="border p-1 text-right font-semibold">{formatCurrency(s.cantidad_pieles * s.valor_unitario)}</td>
                      <td className="border p-1 text-center">
                        <Button size="sm" variant="destructive" onClick={() => setServiciosMaquinaria(serviciosMaquinaria.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-yellow-200 font-bold">
                    <td colSpan="3" className="border p-2 text-right">SUBTOTAL SERVICIO DE MAQUINARIA</td>
                    <td className="border p-2 text-right">{formatCurrency(subtotalMaquinaria)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* SERVICIO DE MANO DE OBRA */}
            <div className="border rounded">
              <div className="bg-teal-600 text-white px-3 py-2 font-bold flex justify-between items-center">
                <span>SERVICIO DE MANO DE OBRA</span>
                <Button size="sm" variant="secondary" onClick={agregarServicioManoObra}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border p-1">NOMBRE DEL SERVICIO</th>
                    <th className="border p-1">CANTIDAD</th>
                    <th className="border p-1">VALOR</th>
                    <th className="border p-1">VALOR TOTAL</th>
                    <th className="border p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {serviciosManoObra.map((s, idx) => (
                    <tr key={idx}>
                      <td className="border p-1"><Input className="h-7 text-xs" value={s.nombre_servicio} onChange={e => {
                        const u = [...serviciosManoObra];
                        u[idx].nombre_servicio = e.target.value;
                        setServiciosManoObra(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={s.cantidad} onChange={e => {
                        const u = [...serviciosManoObra];
                        u[idx].cantidad = parseFloat(e.target.value) || 0;
                        setServiciosManoObra(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={s.valor} onChange={e => {
                        const u = [...serviciosManoObra];
                        u[idx].valor = parseFloat(e.target.value) || 0;
                        setServiciosManoObra(u);
                      }} /></td>
                      <td className="border p-1 text-right font-semibold">{formatCurrency(s.cantidad * s.valor)}</td>
                      <td className="border p-1 text-center">
                        <Button size="sm" variant="destructive" onClick={() => setServiciosManoObra(serviciosManoObra.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-yellow-200 font-bold">
                    <td colSpan="3" className="border p-2 text-right">SUBTOTAL SERVICIO DE MANO DE OBRA</td>
                    <td className="border p-2 text-right">{formatCurrency(subtotalManoObra)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* OTROS COSTOS */}
            <div className="border rounded">
              <div className="bg-red-600 text-white px-3 py-2 font-bold flex justify-between items-center">
                <span>OTROS COSTOS</span>
                <Button size="sm" variant="secondary" onClick={agregarOtroCosto}>
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border p-1">OTROS COSTOS</th>
                    <th className="border p-1">CANTIDAD</th>
                    <th className="border p-1">VALOR</th>
                    <th className="border p-1">VALOR TOTAL</th>
                    <th className="border p-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {otrosCostos.map((c, idx) => (
                    <tr key={idx}>
                      <td className="border p-1"><Input className="h-7 text-xs" value={c.descripcion} onChange={e => {
                        const u = [...otrosCostos];
                        u[idx].descripcion = e.target.value;
                        setOtrosCostos(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={c.cantidad} onChange={e => {
                        const u = [...otrosCostos];
                        u[idx].cantidad = parseFloat(e.target.value) || 0;
                        setOtrosCostos(u);
                      }} /></td>
                      <td className="border p-1"><Input type="number" className="h-7 text-xs" value={c.valor} onChange={e => {
                        const u = [...otrosCostos];
                        u[idx].valor = parseFloat(e.target.value) || 0;
                        setOtrosCostos(u);
                      }} /></td>
                      <td className="border p-1 text-right font-semibold">{formatCurrency(c.cantidad * c.valor)}</td>
                      <td className="border p-1 text-center">
                        <Button size="sm" variant="destructive" onClick={() => setOtrosCostos(otrosCostos.filter((_, i) => i !== idx))}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-yellow-200 font-bold">
                    <td colSpan="3" className="border p-2 text-right">SUBTOTAL OTROS COSTOS</td>
                    <td className="border p-2 text-right">{formatCurrency(subtotalOtros)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* OTROS CONCEPTOS */}
            <div className="border rounded">
              <div className="bg-indigo-700 text-white px-3 py-2 font-bold text-center">
                OTROS CONCEPTOS
              </div>
              <table className="w-full text-xs">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="border p-2">CONCEPTO</th>
                    <th className="border p-2">CANTIDAD</th>
                    <th className="border p-2">VALOR</th>
                    <th className="border p-2">VALOR TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {otrosConceptosCalculados.map((item, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border p-2 font-medium">{item.concepto}</td>
                      <td className="border p-2">
                        {(idx === 0) ? (
                          <Input 
                            type="number" 
                            className="h-7 text-xs" 
                            value={otrosConceptos[idx]?.cantidad || 0} 
                            onChange={e => {
                              const u = [...otrosConceptos];
                              u[idx].cantidad = parseFloat(e.target.value) || 0;
                              setOtrosConceptos(u);
                            }} 
                          />
                        ) : '-'}
                      </td>
                      <td className="border p-2">
                        {(idx === 0 || idx === 3 || idx === 5) ? (
                          <Input 
                            type="number" 
                            className="h-7 text-xs" 
                            value={otrosConceptos[idx]?.valor || 0} 
                            onChange={e => {
                              const u = [...otrosConceptos];
                              u[idx].valor = parseFloat(e.target.value) || 0;
                              setOtrosConceptos(u);
                            }} 
                          />
                        ) : '-'}
                      </td>
                      <td className="border p-2 text-right font-semibold text-blue-700">
                        {formatCurrency(item.valor_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* TOTAL GENERAL */}
            <div className="bg-green-500 text-white border-4 border-green-700 p-4 font-bold text-right text-xl">
              TOTAL GENERAL DEL LOTE: {formatCurrency(totalGeneral)}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={guardarCostosManuales} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Guardar Costos Manuales
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}