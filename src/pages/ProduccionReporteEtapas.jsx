import React, { useState, useEffect } from 'react';
import { ProcesoProduccion } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Clock, AlertCircle } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO');
};

export default function ProduccionReporteEtapas() {
  const [procesos, setProcesos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState(new Date(new Date().setDate(1)).toISOString().split('T')[0]);
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]);
  const [filteredProcesos, setFilteredProcesos] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [procesos, fechaInicio, fechaFin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await ProcesoProduccion.list();
      setProcesos(data);
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = procesos.filter(p => {
      const fecha = new Date(p.fecha_inicio);
      return fecha >= new Date(fechaInicio) && fecha <= new Date(fechaFin);
    });
    setFilteredProcesos(filtered);
  };

  const stats = {
    total: filteredProcesos.length,
    completados: filteredProcesos.filter(p => p.estado === 'completado').length,
    enProceso: filteredProcesos.filter(p => p.estado === 'en_proceso').length,
    pendientes: filteredProcesos.filter(p => p.estado === 'pendiente').length
  };

  const etapas = ['recepcion', 'limpieza', 'curtido', 'acabado', 'recurtido'];
  const etapaStats = etapas.map(etapa => ({
    nombre: etapa,
    total: filteredProcesos.filter(p => p.tipo_proceso === etapa).length,
    completados: filteredProcesos.filter(p => p.tipo_proceso === etapa && p.estado === 'completado').length,
    enProceso: filteredProcesos.filter(p => p.tipo_proceso === etapa && p.estado === 'en_proceso').length
  }));

  const handleExport = () => {
    let csvContent = "Etapa,Total,Completados,En Proceso,Pendientes\n";
    csvContent += etapaStats.map(e =>
      `"${e.nombre}","${e.total}","${e.completados}","${e.enProceso}","${e.total - e.completados - e.enProceso}"`
    ).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_etapas_${fechaInicio}_${fechaFin}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  const headers = ["Etapa", "Total Procesos", "Completados", "En Proceso", "Pendientes", "% Completado"];
  const renderRow = (stat) => {
    const pendientes = stat.total - stat.completados - stat.enProceso;
    const porcentaje = stat.total > 0 ? ((stat.completados / stat.total) * 100).toFixed(1) : 0;
    return (
      <tr key={stat.nombre}>
        <td className="capitalize font-medium">{stat.nombre}</td>
        <td className="text-center">{stat.total}</td>
        <td className="text-center text-green-600">{stat.completados}</td>
        <td className="text-center text-blue-600">{stat.enProceso}</td>
        <td className="text-center text-yellow-600">{pendientes}</td>
        <td className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-24 bg-gray-200 rounded-full h-2">
              <div className="bg-green-600 h-2 rounded-full" style={{ width: `${porcentaje}%` }}></div>
            </div>
            <span className="font-medium">{porcentaje}%</span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
      <PageHeader 
        title="Reporte de Etapas"
        description="Análisis del estado de las etapas de producción."
        onExportExcel={handleExport}
        onPrint={handlePrint}
      />

      <Card className="no-print">
        <CardHeader><CardTitle>Período del Reporte</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Fecha Inicio</Label>
              <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
            </div>
            <div>
              <Label>Fecha Fin</Label>
              <Input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Total Procesos</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Completados</p>
                <p className="text-2xl font-bold text-green-600">{stats.completados}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">En Proceso</p>
                <p className="text-2xl font-bold text-blue-600">{stats.enProceso}</p>
              </div>
              <Clock className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">Pendientes</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pendientes}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="tabla-imprimible">
        <Card>
          <CardHeader><CardTitle>Análisis por Etapa de Producción</CardTitle></CardHeader>
          <CardContent>
            <DataTable headers={headers} data={etapaStats} renderRow={renderRow} loading={loading} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}