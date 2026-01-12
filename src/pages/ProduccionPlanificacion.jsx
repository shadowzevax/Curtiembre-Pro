import React from 'react';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar, Clock, TrendingUp } from 'lucide-react';

export default function ProduccionPlanificacion() {
  const handleExport = () => {
    alert("Funcionalidad de exportación en desarrollo.");
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-6 space-y-6">
      <PageHeader 
        title="Planificación de Producción"
        description="Planifica y organiza los procesos de producción."
        onExportExcel={handleExport}
        onPrint={handlePrint}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              Calendario de Producción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Visualiza el calendario de procesos programados y fechas de entrega.
            </p>
            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-center">
              <p className="text-sm font-medium text-blue-800">Módulo en desarrollo</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              Tiempos de Producción
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Analiza y optimiza los tiempos de cada proceso productivo.
            </p>
            <div className="mt-4 p-4 bg-orange-50 rounded-lg text-center">
              <p className="text-sm font-medium text-orange-800">Módulo en desarrollo</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Capacidad Productiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Monitorea la capacidad y eficiencia de los recursos productivos.
            </p>
            <div className="mt-4 p-4 bg-emerald-50 rounded-lg text-center">
              <p className="text-sm font-medium text-emerald-800">Módulo en desarrollo</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Programación Semanal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 mx-auto text-slate-300 mb-4" />
            <p className="text-slate-500 mb-2">Vista de planificación semanal</p>
            <p className="text-sm text-slate-400">Este módulo estará disponible próximamente con funcionalidades de arrastrar y soltar para programar procesos.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}