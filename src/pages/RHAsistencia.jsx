import React, { useState, useEffect } from 'react';
import { Empleado } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function RHAsistencia() {
    const [empleados, setEmpleados] = useState([]);
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [asistencia, setAsistencia] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await Empleado.filter({ estado: 'activo' });
            setEmpleados(data);
            // Inicializar asistencia con estado "presente" por defecto
            const asistenciaInicial = {};
            data.forEach(emp => {
                asistenciaInicial[emp.id] = {
                    estado: 'presente',
                    horaEntrada: '08:00',
                    horaSalida: '17:00',
                    observaciones: ''
                };
            });
            setAsistencia(asistenciaInicial);
        } catch (error) {
            console.error("Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAsistenciaChange = (empId, field, value) => {
        setAsistencia(prev => ({
            ...prev,
            [empId]: {
                ...prev[empId],
                [field]: value
            }
        }));
    };

    const handleGuardar = () => {
        // Aquí se guardaría en una entidad de Asistencia
        // Por ahora solo mostramos una alerta
        alert(`Asistencia guardada para el día ${new Date(fecha).toLocaleDateString('es-CO')}`);
    };

    const handleExport = () => {
        let csvContent = "Empleado,Cédula,Estado,Hora Entrada,Hora Salida,Observaciones\n";
        csvContent += empleados.map(emp => {
            const ast = asistencia[emp.id] || {};
            return `"${emp.nombre_completo}","${emp.cedula}","${ast.estado}","${ast.horaEntrada}","${ast.horaSalida}","${ast.observaciones}"`;
        }).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `asistencia_${fecha}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const resumen = {
        presentes: Object.values(asistencia).filter(a => a.estado === 'presente').length,
        ausentes: Object.values(asistencia).filter(a => a.estado === 'ausente').length,
        tardanzas: Object.values(asistencia).filter(a => a.estado === 'tardanza').length,
        permisos: Object.values(asistencia).filter(a => a.estado === 'permiso').length
    };

    const headers = ["Empleado", "Cédula", "Estado", "Hora Entrada", "Hora Salida", "Observaciones"];
    const renderRow = (emp) => {
        const ast = asistencia[emp.id] || {};
        return (
            <tr key={emp.id}>
                <td>{emp.nombre_completo}</td>
                <td>{emp.cedula}</td>
                <td>
                    <select 
                        value={ast.estado} 
                        onChange={(e) => handleAsistenciaChange(emp.id, 'estado', e.target.value)}
                        className="px-2 py-1 border rounded text-sm"
                    >
                        <option value="presente">Presente</option>
                        <option value="ausente">Ausente</option>
                        <option value="tardanza">Tardanza</option>
                        <option value="permiso">Permiso</option>
                    </select>
                </td>
                <td>
                    <Input 
                        type="time" 
                        value={ast.horaEntrada} 
                        onChange={(e) => handleAsistenciaChange(emp.id, 'horaEntrada', e.target.value)}
                        className="w-32"
                        disabled={ast.estado === 'ausente'}
                    />
                </td>
                <td>
                    <Input 
                        type="time" 
                        value={ast.horaSalida} 
                        onChange={(e) => handleAsistenciaChange(emp.id, 'horaSalida', e.target.value)}
                        className="w-32"
                        disabled={ast.estado === 'ausente'}
                    />
                </td>
                <td>
                    <Input 
                        value={ast.observaciones} 
                        onChange={(e) => handleAsistenciaChange(emp.id, 'observaciones', e.target.value)}
                        placeholder="Observaciones"
                        className="w-full"
                    />
                </td>
            </tr>
        );
    };

    return (
        <div className="p-6 space-y-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Control de Asistencia"
                description="Registra y gestiona la asistencia diaria de los empleados."
                onExportExcel={handleExport}
                onPrint={handlePrint}
            />

            <Card className="no-print">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Calendar className="w-5 h-5" />
                        Fecha de Asistencia
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex gap-4 items-end">
                        <div className="flex-grow">
                            <Label>Fecha</Label>
                            <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                        </div>
                        <Button onClick={handleGuardar} className="bg-emerald-600 hover:bg-emerald-700">
                            Guardar Asistencia
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Presentes</p>
                                <p className="text-2xl font-bold text-green-600">{resumen.presentes}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Ausentes</p>
                                <p className="text-2xl font-bold text-red-600">{resumen.ausentes}</p>
                            </div>
                            <XCircle className="w-8 h-8 text-red-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Tardanzas</p>
                                <p className="text-2xl font-bold text-orange-600">{resumen.tardanzas}</p>
                            </div>
                            <Clock className="w-8 h-8 text-orange-500" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-600">Permisos</p>
                                <p className="text-2xl font-bold text-blue-600">{resumen.permisos}</p>
                            </div>
                            <Badge className="bg-blue-500">P</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div id="tabla-imprimible">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Registro de Asistencia - {new Date(fecha).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <DataTable headers={headers} data={empleados} renderRow={renderRow} loading={loading} />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}