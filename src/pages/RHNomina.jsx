import React, { useState, useEffect } from 'react';
import { Empleado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, DollarSign } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function RHNomina() {
    const [empleados, setEmpleados] = useState([]);
    const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
    const [loading, setLoading] = useState(true);
    const [nominaData, setNominaData] = useState([]);

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        calcularNomina();
    }, [empleados, periodo]);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await Empleado.filter({ estado: 'activo' });
            setEmpleados(data);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const calcularNomina = () => {
        const nomina = empleados.map(emp => {
            const salarioBase = emp.salario || 0;
            const auxTransporte = salarioBase <= 2600000 ? 162000 : 0;
            const saludEmpleado = salarioBase * 0.04;
            const pensionEmpleado = salarioBase * 0.04;
            const totalDevengado = salarioBase + auxTransporte;
            const totalDeducciones = saludEmpleado + pensionEmpleado;
            const netoAPagar = totalDevengado - totalDeducciones;

            return {
                id: emp.id,
                empleado: emp.nombre_completo,
                cedula: emp.cedula,
                cargo: emp.cargo,
                salarioBase,
                auxTransporte,
                totalDevengado,
                saludEmpleado,
                pensionEmpleado,
                totalDeducciones,
                netoAPagar
            };
        });
        setNominaData(nomina);
    };

    const handleExport = () => {
        let csvContent = "Empleado,Cédula,Cargo,Salario Base,Aux Transporte,Total Devengado,Salud,Pensión,Total Deducciones,Neto a Pagar\n";
        csvContent += nominaData.map(n =>
            `"${n.empleado}","${n.cedula}","${n.cargo}","${n.salarioBase}","${n.auxTransporte}","${n.totalDevengado}","${n.saludEmpleado}","${n.pensionEmpleado}","${n.totalDeducciones}","${n.netoAPagar}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `nomina_${periodo}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const totalGeneral = nominaData.reduce((sum, n) => sum + n.netoAPagar, 0);

    const headers = ["Empleado", "Cédula", "Cargo", "Salario Base", "Aux. Transporte", "Devengado", "Salud", "Pensión", "Deducciones", "Neto a Pagar"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{item.empleado}</td>
            <td>{item.cedula}</td>
            <td>{item.cargo}</td>
            <td className="text-right">{formatCurrency(item.salarioBase)}</td>
            <td className="text-right">{formatCurrency(item.auxTransporte)}</td>
            <td className="text-right font-medium">{formatCurrency(item.totalDevengado)}</td>
            <td className="text-right text-red-600">{formatCurrency(item.saludEmpleado)}</td>
            <td className="text-right text-red-600">{formatCurrency(item.pensionEmpleado)}</td>
            <td className="text-right text-red-600 font-medium">{formatCurrency(item.totalDeducciones)}</td>
            <td className="text-right font-bold text-emerald-700">{formatCurrency(item.netoAPagar)}</td>
        </tr>
    );

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Gestión de Nómina"
                description="Cálculo y administración de la nómina de empleados."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <Card className="no-print">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Período de Nómina
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end">
                        <div className="flex-grow">
                            <Label>Mes y Año</Label>
                            <Input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                        </div>
                        <Button onClick={calcularNomina} className="bg-emerald-600 hover:bg-emerald-700">
                            Calcular Nómina
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <DollarSign className="w-5 h-5" />
                                <span>Nómina - {new Date(periodo + '-01').toLocaleDateString('es-CO', { year: 'numeric', month: 'long' })}</span>
                            </div>
                            <span className="text-sm text-slate-600">Total Empleados: {nominaData.length}</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={nominaData} renderRow={renderRow} loading={loading} />
                        <div className="mt-6 pt-4 border-t">
                            <div className="flex justify-end">
                                <div className="bg-emerald-50 px-6 py-3 rounded-lg">
                                    <span className="text-lg font-bold text-emerald-800">Total Nómina: {formatCurrency(totalGeneral)}</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="no-print">
                <CardHeader>
                    <CardTitle>Información de Cálculo</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-slate-600 space-y-2">
                    <p><strong>Salud Empleado:</strong> 4% del salario base</p>
                    <p><strong>Pensión Empleado:</strong> 4% del salario base</p>
                    <p><strong>Auxilio de Transporte:</strong> $162,000 (para salarios hasta $2,600,000)</p>
                    <p className="text-xs text-slate-500 mt-4">Nota: Este cálculo es simplificado. Consulte con su contador para cálculos oficiales de nómina.</p>
                </CardContent>
            </Card>
        </div>
    );
}