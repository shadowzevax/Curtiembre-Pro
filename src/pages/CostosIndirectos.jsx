import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Users, DollarSign } from 'lucide-react';

export default function CostosIndirectos() {
    const submodulos = [
        {
            title: "Servicios de Maquinaria",
            description: "Gestión de costos de maquinaria y equipos",
            url: createPageUrl("CostosServicioMaquinaria"),
            icon: Wrench,
            color: "bg-blue-500"
        },
        {
            title: "Servicio de Mano de Obra",
            description: "Gestión de costos de mano de obra",
            url: createPageUrl("CostosServicioManoObra"),
            icon: Users,
            color: "bg-green-500"
        },
        {
            title: "Otros Costos",
            description: "Gestión de otros costos indirectos",
            url: createPageUrl("CostosOtrosCostos"),
            icon: DollarSign,
            color: "bg-orange-500"
        }
    ];

    return (
        <div className="p-6 space-y-6">
            <PageHeader 
                title="Costos Indirectos"
                description="Gestiona los costos indirectos de producción"
            />
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {submodulos.map((modulo, idx) => {
                    const Icon = modulo.icon;
                    return (
                        <Link to={modulo.url} key={idx}>
                            <Card className="hover:shadow-xl transition-all duration-300 cursor-pointer border-2 hover:border-emerald-500">
                                <CardHeader>
                                    <div className={`${modulo.color} w-14 h-14 rounded-lg flex items-center justify-center mb-4`}>
                                        <Icon className="w-8 h-8 text-white" />
                                    </div>
                                    <CardTitle className="text-xl">{modulo.title}</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <p className="text-slate-600">{modulo.description}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}