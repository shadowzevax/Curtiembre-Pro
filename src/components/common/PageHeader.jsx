import React from 'react';
import { Button } from '@/components/ui/button';
import { Download, Printer } from 'lucide-react';

export default function PageHeader({ title, description, actionButton, onExportExcel, onPrint }) {

  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6" id="page-header">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        <p className="text-slate-600">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {onExportExcel && (
          <Button variant="outline" size="sm" onClick={onExportExcel} className="text-pink-600 border-pink-600 hover:bg-pink-50 hover:text-pink-700">
            <Download className="w-4 h-4 mr-2" />
            Excel (CSV)
          </Button>
        )}
        {onPrint && (
          <Button variant="outline" size="sm" onClick={onPrint} className="text-pink-600 border-pink-600 hover:bg-pink-50 hover:text-pink-700">
            <Printer className="w-4 h-4 mr-2" />
            Imprimir
          </Button>
        )}
        {actionButton}
      </div>
    </div>
  );
}