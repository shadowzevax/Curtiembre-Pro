import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ProcesoProduccion, CostoIndirecto, Proveedor, RecetaPintura, ServicioProduccion } from '@/entities/all';
import { Loader2 } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function LoteDetalleConsolidado({ open, onOpenChange, codigoLote }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (open && codigoLote) {
            loadDetalleConsolidado();
        }
    }, [open, codigoLote]);

    const loadDetalleConsolidado = async () => {
        setLoading(true);
        try {
            const [procesos, costosIndirectos, proveedores, recetas] = await Promise.all([
                ProcesoProduccion.filter({ codigo_lote: codigoLote }),
                CostoIndirecto.filter({ codigo_lote: codigoLote }),
                Proveedor.list(),
                RecetaPintura.list()
            ]);

            // Agrupar por etapa
            const recepcion = procesos.find(p => p.tipo_proceso === 'recepcion');
            const limpieza = procesos.filter(p => p.tipo_proceso === 'limpieza');
            const curtido = procesos.filter(p => p.tipo_proceso === 'curtido');
            const recurtido = procesos.filter(p => p.tipo_proceso === 'recurtido');
            const acabado = procesos.filter(p => p.tipo_proceso === 'acabado');

            // Costos indirectos
            const serviciosMaquinaria = costosIndirectos.filter(c => c.tipo_costo === 'servicio_maquinaria');
            const manoObra = costosIndirectos.filter(c => c.tipo_costo === 'mano_obra');
            const otrosCostos = costosIndirectos.filter(c => c.tipo_costo === 'otros_costos');
            
            // Servicios de Producción
            const serviciosProduccion = await ServicioProduccion.filter({ codigo_lote: codigoLote });

            const proveedor = recepcion ? proveedores.find(p => p.id === recepcion.proveedor_id) : null;

            setData({
                recepcion,
                limpieza,
                curtido,
                recurtido,
                acabado,
                serviciosMaquinaria,
                manoObra,
                otrosCostos,
                serviciosProduccion,
                recetas,
                proveedor
            });
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    if (!data || loading) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-7xl">
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                        <span className="ml-3">Cargando información del lote...</span>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    const calcularSubtotalEtapa = (procesos) => {
        let total = 0;
        procesos.forEach(p => {
            (p.insumos_utilizados || []).forEach(ins => {
                const costoConIva = (ins.precio_unitario || 0) * (1 + (ins.iva || 0));
                total += (ins.cantidad || 0) * costoConIva;
            });
        });
        return total;
    };

    const calcularSubtotalCostosIndirectos = (costos) => {
        return costos.reduce((sum, c) => sum + (c.valor_total || c.subtotal || 0), 0);
    };

    const subtotalRecepcion = calcularSubtotalEtapa(data.recepcion ? [data.recepcion] : []);
    const subtotalLimpieza = calcularSubtotalEtapa(data.limpieza);
    const subtotalCurtido = calcularSubtotalEtapa(data.curtido);
    const subtotalRecurtido = calcularSubtotalEtapa(data.recurtido);
    const subtotalAcabado = calcularSubtotalEtapa(data.acabado);
    const subtotalMaquinaria = calcularSubtotalCostosIndirectos(data.serviciosMaquinaria);
    const subtotalManoObra = calcularSubtotalCostosIndirectos(data.manoObra);
    const subtotalOtrosCostos = calcularSubtotalCostosIndirectos(data.otrosCostos);
    const subtotalServiciosProduccion = data.serviciosProduccion.reduce((sum, s) => sum + (s.costo_servicio || 0), 0);
    const subtotalRecetas = data.recetas.reduce((sum, r) => sum + (r.costo_total_productos || 0), 0);

    const totalGeneral = subtotalRecepcion + subtotalLimpieza + subtotalCurtido + subtotalRecurtido + subtotalAcabado + subtotalMaquinaria + subtotalManoObra + subtotalOtrosCostos + subtotalServiciosProduccion + subtotalRecetas;

    const renderInsumos = (insumos) => {
        if (!insumos || insumos.length === 0) return <tr><td colSpan="7" className="text-center text-gray-400 py-2">Sin insumos</td></tr>;
        return insumos.map((ins, idx) => {
            const costoConIva = (ins.precio_unitario || 0) * (1 + (ins.iva || 0));
            const valorTotal = (ins.cantidad || 0) * costoConIva;
            return (
                <tr key={idx} className="border-t">
                    <td className="p-2">{ins.codigo}</td>
                    <td className="p-2">{ins.producto}</td>
                    <td className="p-2 text-right">{ins.cantidad}</td>
                    <td className="p-2 text-right">{formatCurrency(ins.precio_unitario)}</td>
                    <td className="p-2 text-right">{formatCurrency(ins.precio_unitario * (ins.iva || 0))}</td>
                    <td className="p-2 text-right">{formatCurrency(costoConIva)}</td>
                    <td className="p-2 text-right font-bold">{formatCurrency(valorTotal)}</td>
                </tr>
            );
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Detalle Consolidado del Lote: {codigoLote}</DialogTitle></DialogHeader>
                
                {/* Encabezado */}
                <div className="bg-slate-100 p-4 rounded-lg grid grid-cols-6 gap-4 text-sm">
                    <div><span className="font-semibold">Código Lote:</span> {codigoLote}</div>
                    <div><span className="font-semibold">Proveedor:</span> {data.proveedor?.nombre || 'N/A'}</div>
                    <div><span className="font-semibold">Doc. Compra:</span> {data.recepcion?.no_documento || 'N/A'}</div>
                    <div><span className="font-semibold">Cant. Pieles:</span> {data.recepcion?.cantidad_total_lote_pieles || 0}</div>
                    <div><span className="font-semibold">Cant. Hojas:</span> {data.recepcion?.cantidad_total_lote_hojas || 0}</div>
                    <div><span className="font-semibold">Fecha:</span> {data.recepcion ? new Date(data.recepcion.fecha_inicio).toLocaleDateString() : 'N/A'}</div>
                    <div className="col-span-6"><span className="font-semibold">Curtidor:</span> {data.recepcion?.nombre_curtidor || 'N/A'}</div>
                </div>

                {/* Tabla Consolidada */}
                <div className="border rounded-lg overflow-x-auto mt-4">
                    <table className="w-full text-xs">
                        <thead className="bg-slate-200">
                            <tr>
                                <th className="p-2 text-left">Etapa</th>
                                <th className="p-2">Código</th>
                                <th className="p-2">Producto</th>
                                <th className="p-2 text-right">Cantidad</th>
                                <th className="p-2 text-right">Costo Unit.</th>
                                <th className="p-2 text-right">Valor IVA</th>
                                <th className="p-2 text-right">Costo + IVA</th>
                                <th className="p-2 text-right">Valor Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* RECEPCIÓN */}
                            {data.recepcion && (
                                <>
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="p-2" colSpan="8">RECEPCIÓN - Pieles: {data.recepcion.cantidad_total_lote_pieles || 0}, Peso: {data.recepcion.peso_total || 0} kg</td>
                                    </tr>
                                    {renderInsumos(data.recepcion.insumos_utilizados || [])}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Recepción:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalRecepcion)}</td>
                                    </tr>
                                </>
                            )}

                            {/* LIMPIEZA */}
                            {data.limpieza.length > 0 && (
                                <>
                                    <tr className="bg-blue-100 font-bold">
                                        <td className="p-2" colSpan="8">LIMPIEZA</td>
                                    </tr>
                                    {data.limpieza.map(p => renderInsumos(p.insumos_utilizados || []))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Limpieza:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalLimpieza)}</td>
                                    </tr>
                                </>
                            )}

                            {/* CURTIDO */}
                            {data.curtido.length > 0 && (
                                <>
                                    <tr className="bg-yellow-100 font-bold">
                                        <td className="p-2" colSpan="8">CURTIDO</td>
                                    </tr>
                                    {data.curtido.map(p => renderInsumos(p.insumos_utilizados || []))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Curtido:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalCurtido)}</td>
                                    </tr>
                                </>
                            )}

                            {/* RECURTIDO */}
                            {data.recurtido.length > 0 && (
                                <>
                                    <tr className="bg-purple-100 font-bold">
                                        <td className="p-2" colSpan="8">RECURTIDO</td>
                                    </tr>
                                    {data.recurtido.map(p => renderInsumos(p.insumos_utilizados || []))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Recurtido:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalRecurtido)}</td>
                                    </tr>
                                </>
                            )}

                            {/* ACABADO */}
                            {data.acabado.length > 0 && (
                                <>
                                    <tr className="bg-pink-100 font-bold">
                                        <td className="p-2" colSpan="8">ACABADO</td>
                                    </tr>
                                    {data.acabado.map(p => renderInsumos(p.insumos_utilizados || []))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Acabado:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalAcabado)}</td>
                                    </tr>
                                </>
                            )}

                            {/* COSTOS INDIRECTOS - MAQUINARIA */}
                            {data.serviciosMaquinaria.length > 0 && (
                                <>
                                    <tr className="bg-orange-100 font-bold">
                                        <td className="p-2" colSpan="8">COSTOS INDIRECTOS - Servicios de Maquinaria</td>
                                    </tr>
                                    {data.serviciosMaquinaria.map((c, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td></td>
                                            <td className="p-2" colSpan="2">{c.nombre_servicio}</td>
                                            <td className="p-2 text-right">{c.cantidad_pieles}</td>
                                            <td className="p-2" colSpan="3"></td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(c.valor_total || c.subtotal)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Maquinaria:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalMaquinaria)}</td>
                                    </tr>
                                </>
                            )}

                            {/* COSTOS INDIRECTOS - MANO DE OBRA */}
                            {data.manoObra.length > 0 && (
                                <>
                                    <tr className="bg-orange-100 font-bold">
                                        <td className="p-2" colSpan="8">COSTOS INDIRECTOS - Mano de Obra</td>
                                    </tr>
                                    {data.manoObra.map((c, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td></td>
                                            <td className="p-2" colSpan="2">{c.nombre_servicio}</td>
                                            <td className="p-2 text-right">{c.cantidad_pieles}</td>
                                            <td className="p-2" colSpan="3"></td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(c.valor_total || c.subtotal)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Mano de Obra:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalManoObra)}</td>
                                    </tr>
                                </>
                            )}

                            {/* COSTOS INDIRECTOS - OTROS */}
                            {data.otrosCostos.length > 0 && (
                                <>
                                    <tr className="bg-orange-100 font-bold">
                                        <td className="p-2" colSpan="8">COSTOS INDIRECTOS - Otros Costos</td>
                                    </tr>
                                    {data.otrosCostos.map((c, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td></td>
                                            <td className="p-2" colSpan="2">{c.nombre_servicio}</td>
                                            <td className="p-2 text-right">{c.cantidad_pieles}</td>
                                            <td className="p-2" colSpan="3"></td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(c.subtotal || c.valor_total)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Otros Costos:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalOtrosCostos)}</td>
                                    </tr>
                                </>
                            )}

                            {/* SERVICIOS DE PRODUCCIÓN */}
                            {data.serviciosProduccion.length > 0 && (
                                <>
                                    <tr className="bg-indigo-100 font-bold">
                                        <td className="p-2" colSpan="8">SERVICIOS DE PRODUCCIÓN</td>
                                    </tr>
                                    {data.serviciosProduccion.map((s, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td></td>
                                            <td className="p-2" colSpan="2">{s.tipo_servicio?.replace('_', ' ')}</td>
                                            <td className="p-2 text-right">{s.cantidad_hojas || s.cantidad_pieles}</td>
                                            <td className="p-2" colSpan="3"></td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(s.costo_servicio)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Servicios Producción:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalServiciosProduccion)}</td>
                                    </tr>
                                </>
                            )}

                            {/* RECETAS DE PINTURA */}
                            {data.recetas.length > 0 && (
                                <>
                                    <tr className="bg-purple-100 font-bold">
                                        <td className="p-2" colSpan="8">RECETAS DE PINTURA</td>
                                    </tr>
                                    {data.recetas.map((r, idx) => (
                                        <tr key={idx} className="border-t">
                                            <td></td>
                                            <td className="p-2" colSpan="2">{r.nombre_receta}</td>
                                            <td className="p-2 text-right">{r.cantidad_base_por_hoja}</td>
                                            <td className="p-2" colSpan="3"></td>
                                            <td className="p-2 text-right font-bold">{formatCurrency(r.costo_total_productos)}</td>
                                        </tr>
                                    ))}
                                    <tr className="bg-emerald-50 font-bold">
                                        <td colSpan="7" className="p-2 text-right">Subtotal Recetas Pintura:</td>
                                        <td className="p-2 text-right text-emerald-700">{formatCurrency(subtotalRecetas)}</td>
                                    </tr>
                                </>
                            )}

                            {/* TOTAL GENERAL */}
                            <tr className="bg-emerald-600 text-white font-bold text-lg">
                                <td colSpan="7" className="p-3 text-right">COSTO TOTAL DEL LOTE:</td>
                                <td className="p-3 text-right">{formatCurrency(totalGeneral)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-end pt-4">
                    <Button onClick={() => onOpenChange(false)}>Cerrar</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}