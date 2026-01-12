import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Construction } from 'lucide-react';
import PageHeader from './PageHeader';

export default function PlaceholderPage({ title, description }) {
  return (
    <div className="p-6">
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center text-center text-slate-500 h-64">
            <Construction className="w-16 h-16 mb-4 text-orange-400" />
            <h3 className="text-xl font-semibold text-slate-700">Módulo en Construcción</h3>
            <p className="mt-2 max-w-md">
              Esta sección está siendo desarrollada y estará disponible próximamente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}