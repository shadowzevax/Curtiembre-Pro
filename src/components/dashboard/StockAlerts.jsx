import React, { useState, useEffect } from 'react';
import { Insumo, ProductoTerminado, MovimientoInventario } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StockAlerts() {
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAlerts();
    }, []);

    const loadAlerts = async () => {
        try {
            const [insumos, productos, movimientos] = await Promise.all([
                Insumo.list(),
                ProductoTerminado.list(),
                MovimientoInventario.list()
            ]);

            const alertas = [];

            // Procesar insumos
            insumos.forEach(ins => {
                const movs = movimientos.filter(m => m.insumo_id === ins.id);
                const stock = movs.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                if (stock <= ins.stock_minimo) {
                    alertas.push({
                        codigo: ins.codigo,
                        nombre: ins.nombre || ins.descripcion,
                        stock,
                        stockMinimo: ins.stock_minimo,
                        tipo: 'Insumo/Químico',
                        url: createPageUrl('InventarioInsumos'),
                        nivel: stock <= 0 ? 'critico' : (stock <= ins.stock_minimo ? 'bajo' : 'normal')
                    });
                }
            });

            // Procesar productos
            productos.forEach(prod => {
                const movs = movimientos.filter(m => m.insumo_id === prod.id);
                const stock = movs.reduce((sum, m) => sum + (parseFloat(m.cantidad) || 0), 0);
                if (stock <= prod.stock_minimo) {
                    const tipoInv = prod.categoria === 'pieles' ? 'Materia Prima' : 'Producto Terminado';
                    const url = prod.categoria === 'pieles' ? 'InventarioProduccion' : 'InventarioProductos';
                    alertas.push({
                        codigo: prod.codigo,
                        nombre: prod.descripcion,
                        stock,
                        stockMinimo: prod.stock_minimo,
                        tipo: tipoInv,
                        url: createPageUrl(url),
                        nivel: stock <= 0 ? 'critico' : (stock <= prod.stock_minimo ? 'bajo' : 'normal')
                    });
                }
            });

            setAlerts(alertas.sort((a, b) => (a.nivel === 'critico' ? -1 : 1)));
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <Card><CardContent className="p-6">Cargando alertas...</CardContent></Card>;
    if (alerts.length === 0) return null;

    return (
        <Card className="border-red-200 bg-red-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    Alertas de Stock ({alerts.length})
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-2">
                    {alerts.slice(0, 10).map((alert, idx) => (
                        <Link 
                            key={idx} 
                            to={alert.url}
                            className="block p-3 bg-white rounded-lg hover:bg-red-100 transition-colors border border-red-200"
                        >
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <Package className="w-4 h-4 text-red-600" />
                                    <div>
                                        <p className="font-semibold text-sm">{alert.codigo} - {alert.nombre}</p>
                                        <p className="text-xs text-gray-600">{alert.tipo}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`font-bold ${alert.nivel === 'critico' ? 'text-red-700' : 'text-yellow-700'}`}>
                                        Stock: {alert.stock}
                                    </p>
                                    <p className="text-xs text-gray-500">Mínimo: {alert.stockMinimo}</p>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}