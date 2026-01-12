import React, { useState, useEffect, useCallback } from 'react';
import { CuentaContable, Cliente } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function ContabilidadCobrar() {
    const [cuentas, setCuentas] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [cuentasData, cliData] = await Promise.all([
                CuentaContable.filter({ tipo_cuenta: "cuentas_cobrar" }),
                Cliente.list()
            ]);
            setCuentas(cuentasData);
            setClientes(cliData);
        } catch (error) { console.error("Error:", error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    
    const getClienteNombre = (id) => clientes.find(c => c.id === id)?.nombre || 'N/A';
    
    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Fecha", "Cliente", "Concepto", "Valor", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>{new Date(item.fecha).toLocaleDateString()}</td>
            <td>{getClienteNombre(item.proveedor_cliente_id)}</td>
            <td>{item.concepto}</td>
            <td>{new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(item.valor)}</td>
            <td>{item.estado}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm"><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm"><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader 
                title="Cuentas por Cobrar"
                description="Gestiona las facturas y deudas pendientes de clientes."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nueva Cuenta por Cobrar
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Listado de Cuentas</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={cuentas} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>
        </div>
    );
}