import React, { useState, useEffect, useCallback } from 'react';
import { MovimientoLibroDiario } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import LibroDiarioNuevoRegistro from './LibroDiarioNuevo';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function LibroDiario() {
    const [movimientos, setMovimientos] = useState([]);
    const [filteredMovimientos, setFilteredMovimientos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchDateStart, setSearchDateStart] = useState('');
    const [searchDateEnd, setSearchDateEnd] = useState('');
    const [showNuevoModal, setShowNuevoModal] = useState(false);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Fetch all movements sorted by date asc (or desc if preferred, but for running balance asc is better)
            const data = await MovimientoLibroDiario.list();
            // Sort by date ascending to calculate running balance
            const sortedData = data.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
            
            // Calculate running balance
            let runningBalance = 0;
            const dataWithBalance = sortedData.map(m => {
                const ingreso = parseFloat(m.valor_ingreso) || 0;
                const egreso = parseFloat(m.valor_egreso) || 0;
                const net = ingreso - egreso;
                runningBalance += net;
                return { ...m, saldo_calculado: runningBalance };
            });

            setMovimientos(dataWithBalance);
            setFilteredMovimientos(dataWithBalance);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    useEffect(() => {
        let filtered = movimientos;
        if (searchDateStart) {
            filtered = filtered.filter(m => m.fecha >= searchDateStart);
        }
        if (searchDateEnd) {
            filtered = filtered.filter(m => m.fecha <= searchDateEnd);
        }
        setFilteredMovimientos(filtered);
    }, [searchDateStart, searchDateEnd, movimientos]);

    const handleExport = () => {
        // Simple CSV export logic
        const headers = ["ID", "Fecha", "Tipo", "Tercero", "Doc Soporte", "No. Doc", "Cuenta", "Descripción", "Ingreso", "Egreso", "Saldo", "Origen"];
        let csvContent = headers.join(",") + "\n";
        filteredMovimientos.forEach(m => {
            const row = [
                m.consecutivo || m.id,
                m.fecha,
                m.tipo_movimiento,
                `"${m.tercero_nombre || ''}"`,
                m.tipo_documento_soporte,
                m.numero_documento,
                m.cuenta_afectada,
                `"${m.descripcion}"`,
                m.valor_ingreso,
                m.valor_egreso,
                m.saldo_calculado,
                m.origen_modulo
            ].join(",");
            csvContent += row + "\n";
        });
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "libro_diario.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handlePrint = () => window.print();

    const headers = ["Fecha", "Tipo", "Tercero", "Doc. Soporte", "Concepto", "Ingreso", "Egreso", "Saldo", "Origen"];
    const renderRow = (m) => (
        <tr key={m.id}>
            <td>{new Date(m.fecha).toLocaleDateString()}</td>
            <td className={m.tipo_movimiento === 'ingreso' ? 'text-green-600 font-bold capitalize' : 'text-red-600 font-bold capitalize'}>{m.tipo_movimiento}</td>
            <td>{m.tercero_nombre}</td>
            <td>{m.tipo_documento_soporte} #{m.numero_documento}</td>
            <td>{m.descripcion}</td>
            <td className="text-right text-green-700">{m.valor_ingreso > 0 ? formatCurrency(m.valor_ingreso) : '-'}</td>
            <td className="text-right text-red-700">{m.valor_egreso > 0 ? formatCurrency(m.valor_egreso) : '-'}</td>
            <td className="text-right font-bold">{formatCurrency(m.saldo_calculado)}</td>
            <td className="capitalize">{m.origen_modulo}</td>
        </tr>
    );

    return (
        <div className="p-6">
             <style>{`
                @media print {
                  body * { visibility: hidden; }
                  #tabla-imprimible, #tabla-imprimible * { visibility: visible; }
                  #tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; }
                  #page-header { display: none; }
                }
            `}</style>
            <PageHeader 
                title="Libro Diario" 
                description="Registro centralizado de movimientos contables."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => setShowNuevoModal(true)} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Registro
                    </Button>
                }
            />
            
            <Card className="mb-6">
                <CardHeader><CardTitle>Filtros de Fecha</CardTitle></CardHeader>
                <CardContent>
                    <div className="flex gap-4">
                        <div><Label>Desde</Label><Input type="date" value={searchDateStart} onChange={e => setSearchDateStart(e.target.value)} /></div>
                        <div><Label>Hasta</Label><Input type="date" value={searchDateEnd} onChange={e => setSearchDateEnd(e.target.value)} /></div>
                    </div>
                </CardContent>
            </Card>

            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Movimientos</CardTitle></CardHeader>
                <CardContent>
                    {loading ? <p>Cargando...</p> : <DataTable headers={headers} data={filteredMovimientos} renderRow={renderRow} />}
                </CardContent>
            </Card>

            {showNuevoModal && (
                <LibroDiarioNuevoRegistro 
                    open={showNuevoModal}
                    onOpenChange={setShowNuevoModal}
                    onSuccess={loadData}
                />
            )}
        </div>
    );
}