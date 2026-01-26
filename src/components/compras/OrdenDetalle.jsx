import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);
const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-ES') : 'N/A';

export default function OrdenDetalle({ orden, proveedorNombre, open, onOpenChange }) {
    if (!orden) return null;

    const totals = {
        subtotal: orden.items?.reduce((sum, item) => sum + (item.subtotal || 0), 0) || orden.subtotal || 0,
        impuestos: orden.impuestos || 0,
        total: orden.total || 0,
    };
    
    if (totals.total === 0 && (totals.subtotal > 0 || totals.impuestos > 0)) {
        totals.total = totals.subtotal + totals.impuestos;
    }


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Detalle de Orden de Compra: {orden.numero_orden}</DialogTitle>
                    <DialogDescription>
                        Información completa de la orden realizada a <span className="font-semibold">{proveedorNombre}</span>.
                    </DialogDescription>
                </DialogHeader>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="font-semibold text-slate-600">Proveedor</p>
                        <p>{proveedorNombre}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-600">Fecha de Orden</p>
                        <p>{formatDate(orden.fecha_orden)}</p>
                    </div>
                    <div>
                        <p className="font-semibold text-slate-600">Estado</p>
                        <Badge variant="outline" className="capitalize">{orden.estado}</Badge>
                    </div>
                </div>

                <div className="mt-6">
                    <h4 className="font-semibold mb-2">Ítems de la Compra</h4>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-slate-600">Código</th>
                                    <th className="px-4 py-2 text-left font-medium text-slate-600">Descripción</th>
                                    <th className="px-4 py-2 text-right font-medium text-slate-600">Cantidad</th>
                                    <th className="px-4 py-2 text-right font-medium text-slate-600">Precio Unit.</th>
                                    <th className="px-4 py-2 text-right font-medium text-slate-600">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orden.items?.map((item, index) => (
                                    <tr key={index} className="border-t">
                                        <td className="px-4 py-2">{item.codigo || 'N/A'}</td>
                                        <td className="px-4 py-2">{item.descripcion || 'N/A'}</td>
                                        <td className="px-4 py-2 text-right">{item.cantidad}</td>
                                        <td className="px-4 py-2 text-right">{formatCurrency(item.precio_unitario)}</td>
                                        <td className="px-4 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                
                 <div className="mt-6 flex justify-end">
                    <div className="w-full max-w-sm space-y-2">
                        <div className="flex justify-between">
                            <span className="text-slate-600">Subtotal:</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-slate-600">Impuestos (IVA):</span>
                            <span className="font-medium">{formatCurrency(totals.impuestos)}</span>
                        </div>
                        <div className="border-t my-2"></div>
                        <div className="flex justify-between text-lg font-bold">
                            <span>Total:</span>
                            <span>{formatCurrency(totals.total)}</span>
                        </div>
                    </div>
                </div>

                {orden.observaciones && (
                    <div className="mt-6">
                        <h4 className="font-semibold mb-2">Observaciones</h4>
                        <p className="text-sm p-3 bg-slate-50 rounded-md border">{orden.observaciones}</p>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}