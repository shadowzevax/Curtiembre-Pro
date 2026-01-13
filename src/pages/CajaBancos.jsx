import React, { useState, useEffect } from 'react';
import { Caja, CuentaBancaria, MovimientoCaja, MovimientoBancario } from '@/entities/all';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '../components/common/PageHeader';
import { Wallet, Building2, TrendingUp, TrendingDown } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function CajaBancos() {
    const [cajas, setCajas] = useState([]);
    const [cuentas, setCuentas] = useState([]);
    const [movimientosCaja, setMovimientosCaja] = useState([]);
    const [movimientosBanco, setMovimientosBanco] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [cajasData, cuentasData, movsCajaData, movsBancoData] = await Promise.all([
                Caja.list(),
                CuentaBancaria.list(),
                MovimientoCaja.list('-fecha', 50),
                MovimientoBancario.list('-fecha', 50)
            ]);
            setCajas(cajasData);
            setCuentas(cuentasData);
            setMovimientosCaja(movsCajaData);
            setMovimientosBanco(movsBancoData);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getTotalCajas = () => cajas.reduce((sum, c) => sum + (c.saldo_actual || 0), 0);
    const getTotalBancos = () => cuentas.reduce((sum, c) => sum + (c.saldo_actual || 0), 0);
    const getTotalGeneral = () => getTotalCajas() + getTotalBancos();

    return (
        <div className="p-6 space-y-6">
            <PageHeader 
                title="Caja y Bancos"
                description="Saldos y movimientos consolidados de cajas y cuentas bancarias."
            />

            {/* Resumen de Saldos */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">Total Cajas</CardTitle>
                        <Wallet className="w-5 h-5 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-700">{formatCurrency(getTotalCajas())}</div>
                        <p className="text-xs text-gray-500">{cajas.length} caja(s) activa(s)</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">Total Bancos</CardTitle>
                        <Building2 className="w-5 h-5 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-700">{formatCurrency(getTotalBancos())}</div>
                        <p className="text-xs text-gray-500">{cuentas.length} cuenta(s) activa(s)</p>
                    </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle className="text-sm font-medium">Total General</CardTitle>
                        <TrendingUp className="w-5 h-5 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-700">{formatCurrency(getTotalGeneral())}</div>
                        <p className="text-xs text-purple-600">Disponible total</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs para Cajas y Bancos */}
            <Tabs defaultValue="cajas" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="cajas">Cajas</TabsTrigger>
                    <TabsTrigger value="bancos">Bancos</TabsTrigger>
                </TabsList>

                <TabsContent value="cajas" className="space-y-4">
                    {/* Listado de Cajas */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cajas.map(caja => (
                            <Card key={caja.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{caja.nombre}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Tipo:</span>
                                            <span className="font-medium capitalize">{caja.tipo}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Saldo:</span>
                                            <span className="font-bold text-blue-700">{formatCurrency(caja.saldo_actual)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Últimos Movimientos de Caja */}
                    <Card>
                        <CardHeader><CardTitle>Últimos Movimientos</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {movimientosCaja.slice(0, 10).map(mov => (
                                    <div key={mov.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {mov.tipo === 'ingreso' ? 
                                                <TrendingUp className="w-4 h-4 text-green-600" /> : 
                                                <TrendingDown className="w-4 h-4 text-red-600" />
                                            }
                                            <div>
                                                <p className="font-medium text-sm">{mov.concepto}</p>
                                                <p className="text-xs text-gray-500">{new Date(mov.fecha).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                        <span className={`font-bold ${mov.tipo === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                                            {mov.tipo === 'ingreso' ? '+' : '-'}{formatCurrency(mov.monto)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bancos" className="space-y-4">
                    {/* Listado de Cuentas Bancarias */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {cuentas.map(cuenta => (
                            <Card key={cuenta.id}>
                                <CardHeader>
                                    <CardTitle className="text-base">{cuenta.banco}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Tipo:</span>
                                            <span className="font-medium capitalize">{cuenta.tipo_cuenta?.replace('_', ' ')}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">No. Cuenta:</span>
                                            <span className="font-medium">{cuenta.numero_cuenta}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm text-gray-600">Saldo:</span>
                                            <span className="font-bold text-emerald-700">{formatCurrency(cuenta.saldo_actual)}</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Últimos Movimientos Bancarios */}
                    <Card>
                        <CardHeader><CardTitle>Últimos Movimientos Bancarios</CardTitle></CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {movimientosBanco.slice(0, 10).map(mov => (
                                    <div key={mov.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            {mov.tipo_movimiento === 'ingreso' ? 
                                                <TrendingUp className="w-4 h-4 text-green-600" /> : 
                                                <TrendingDown className="w-4 h-4 text-red-600" />
                                            }
                                            <div>
                                                <p className="font-medium text-sm">{mov.concepto}</p>
                                                <p className="text-xs text-gray-500">{new Date(mov.fecha).toLocaleDateString()} - {mov.numero_transaccion || 'N/A'}</p>
                                            </div>
                                        </div>
                                        <span className={`font-bold ${mov.tipo_movimiento === 'ingreso' ? 'text-green-700' : 'text-red-700'}`}>
                                            {mov.tipo_movimiento === 'ingreso' ? '+' : '-'}{formatCurrency(mov.valor)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}