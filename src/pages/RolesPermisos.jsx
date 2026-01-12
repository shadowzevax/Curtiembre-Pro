import React from 'react';
import PageHeader from '../components/common/PageHeader';
import PlaceholderPage from '../components/common/PlaceholderPage';

export default function RolesPermisos() {
  const handleExport = () => alert("Función de exportar en desarrollo.");
  const handlePrint = () => window.print();
  return (
    <div className="p-6">
      <PageHeader 
        title="Roles y Permisos"
        description="Configura los permisos para cada rol de usuario."
        onExportExcel={handleExport}
        onPrint={handlePrint}
      />
      <PlaceholderPage
        title="Módulo en Construcción"
        subtitle="Esta sección para configurar roles y permisos está siendo desarrollada."
      />
    </div>
  );
}