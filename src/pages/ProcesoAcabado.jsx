import React, { useState, useEffect, useCallback } from 'react';
import { ProcesoProduccion } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, Table } from 'lucide-react';
import LoteDetalleConsolidado from '../components/produccion/LoteDetalleConsolidado';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP' }).format(amount || 0);

export default function ProcesoAcabado() {
  const [procesos, setProcesos] = useState([]);
  const [lotesDisponibles, setLotesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentItem, setCurrentItem] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showConsolidadoModal, setShowConsolidadoModal] = useState(false);
  const [loteConsolidado, setLoteConsolidado] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [procesosData, todosProcesos] = await Promise.all([
        ProcesoProduccion.filter({ tipo_proceso: 'acabado' }),
        ProcesoProduccion.list()
      ]);
      setProcesos(procesosData);
      
      // Lotes disponibles: aquellos que han pasado por recurtido (o curtido si recurtido no es obligatorio) y no tienen acabado finalizado
      // Simplificación: Todos los lotes únicos
      const unicos = [...new Set(todosProcesos.map(p => p.codigo_lote))].filter(l => l);
      setLotesDisponibles(unicos);

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleOpenModal = (item = null) => {
    setIsEditing(!!item);
    setCurrentItem(item || {
      tipo_proceso: 'acabado',
      codigo_lote: '',
      
      // Abatanado
      abatanado_fecha: '',
      abatanado_cantidad_hojas: 0,
      abatanado_tiempo: 0,
      abatanado_estado: 'pendiente',
      abatanado_obs: '',

      // Planchado
      planchado_fecha: '',
      planchado_cantidad_hojas: 0,
      planchado_tiempo: 0,
      planchado_costo: 0,
      planchado_estado: 'pendiente',
      planchado_obs: '',

      // Esmerilado
      esmerilado_fecha: '',
      esmerilado_cantidad_hojas: 0,
      esmerilado_costo_hoja: 0,
      esmerilado_estado: 'pendiente',
      esmerilado_obs: '',

      costo_total_acabado: 0,
      estado: 'pendiente'
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
        // Calcular costos
        const costoPlanchado = parseFloat(currentItem.planchado_costo) || 0;
        const costoEsmerilado = (parseFloat(currentItem.esmerilado_cantidad_hojas) || 0) * (parseFloat(currentItem.esmerilado_costo_hoja) || 0);
        const totalAcabado = costoPlanchado + costoEsmerilado;

        const dataToSave = {
            ...currentItem,
            costo_total_acabado: totalAcabado,
            numero_proceso: `${currentItem.codigo_lote}-ACB`,
            // Estado general del proceso
            estado: (currentItem.abatanado_estado === 'finalizado' && currentItem.planchado_estado === 'finalizado' && currentItem.esmerilado_estado === 'finalizado') ? 'completado' : 'en_proceso'
        };

        if (isEditing) {
            await ProcesoProduccion.update(currentItem.id, dataToSave);
        } else {
            await ProcesoProduccion.create(dataToSave);
        }
        setShowModal(false);
        loadData();
        alert('Proceso de acabado guardado con éxito.');
    } catch (error) {
        console.error('Error saving:', error);
        alert('Error al guardar el proceso.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este proceso?')) return;
    try {
      await ProcesoProduccion.delete(id);
      loadData();
      alert('Proceso eliminado.');
    } catch (error) { console.error(error); }
  };

  const handleViewDetails = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const headers = ['Lote', 'Estado Abatanado', 'Estado Planchado', 'Estado Esmerilado', 'Costo Total', 'Estado General', 'Acciones'];
  const renderRow = (item) => {
      const costoEsmerilado = (item.esmerilado_cantidad_hojas || 0) * (item.esmerilado_costo_hoja || 0);
      const total = (item.planchado_costo || 0) + costoEsmerilado;
      
      return (
        <tr key={item.id}>
          <td>{item.codigo_lote}</td>
          <td className="capitalize">{item.abatanado_estado}</td>
          <td className="capitalize">{item.planchado_estado}</td>
          <td className="capitalize">{item.esmerilado_estado}</td>
          <td className="text-right font-bold">{formatCurrency(total)}</td>
          <td><span className="capitalize badge">{item.estado}</span></td>
          <td>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={() => { setLoteConsolidado(item.codigo_lote); setShowConsolidadoModal(true); }} title="Ver Consolidado"><Table className="w-4 h-4 text-emerald-600" /></Button>
              <Button variant="outline" size="sm" onClick={() => handleViewDetails(item)}><Eye className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
              <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </td>
        </tr>
      );
  };

  const InputGroup = ({ label, value, onChange, type = "text", step }) => (
      <div><Label>{label}</Label><Input type={type} step={step} value={value} onChange={onChange} /></div>
  );

  return (
    <div className="p-6">
      <PageHeader title="Proceso de Acabado" description="Gestión de Abatanado, Planchado y Esmerilado." actionButton={<Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="w-4 h-4 mr-2" /> Nuevo Acabado</Button>} />
      <Card><CardContent>{loading ? <p>Cargando...</p> : <DataTable headers={headers} data={procesos} renderRow={renderRow} />}</CardContent></Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Proceso de Acabado</DialogTitle></DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
                <Label>Código Lote *</Label>
                <Select value={currentItem?.codigo_lote || ''} onValueChange={v => setCurrentItem({...currentItem, codigo_lote: v})}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar lote" /></SelectTrigger>
                    <SelectContent>
                        {lotesDisponibles.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            <Tabs defaultValue="abatanado" className="w-full border rounded-lg p-4">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="abatanado">Abatanado</TabsTrigger>
                    <TabsTrigger value="planchado">Planchado</TabsTrigger>
                    <TabsTrigger value="esmerilado">Esmerilado</TabsTrigger>
                </TabsList>
                
                <TabsContent value="abatanado" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Fecha" type="date" value={currentItem?.abatanado_fecha} onChange={e => setCurrentItem({...currentItem, abatanado_fecha: e.target.value})} />
                        <InputGroup label="Cantidad Hojas" type="number" value={currentItem?.abatanado_cantidad_hojas} onChange={e => setCurrentItem({...currentItem, abatanado_cantidad_hojas: parseFloat(e.target.value)})} />
                        <InputGroup label="Tiempo Proceso (hrs)" type="number" value={currentItem?.abatanado_tiempo} onChange={e => setCurrentItem({...currentItem, abatanado_tiempo: parseFloat(e.target.value)})} />
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.abatanado_estado} onValueChange={v => setCurrentItem({...currentItem, abatanado_estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="finalizado">Finalizado</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <InputGroup label="Observaciones" value={currentItem?.abatanado_obs} onChange={e => setCurrentItem({...currentItem, abatanado_obs: e.target.value})} />
                </TabsContent>

                <TabsContent value="planchado" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Fecha" type="date" value={currentItem?.planchado_fecha} onChange={e => setCurrentItem({...currentItem, planchado_fecha: e.target.value})} />
                        <InputGroup label="Cantidad Hojas" type="number" value={currentItem?.planchado_cantidad_hojas} onChange={e => setCurrentItem({...currentItem, planchado_cantidad_hojas: parseFloat(e.target.value)})} />
                        <InputGroup label="Tiempo Proceso" type="number" value={currentItem?.planchado_tiempo} onChange={e => setCurrentItem({...currentItem, planchado_tiempo: parseFloat(e.target.value)})} />
                        <InputGroup label="Costo Proceso" type="number" value={currentItem?.planchado_costo} onChange={e => setCurrentItem({...currentItem, planchado_costo: parseFloat(e.target.value)})} />
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.planchado_estado} onValueChange={v => setCurrentItem({...currentItem, planchado_estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="finalizado">Finalizado</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <InputGroup label="Observaciones" value={currentItem?.planchado_obs} onChange={e => setCurrentItem({...currentItem, planchado_obs: e.target.value})} />
                </TabsContent>

                <TabsContent value="esmerilado" className="space-y-4 pt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Fecha" type="date" value={currentItem?.esmerilado_fecha} onChange={e => setCurrentItem({...currentItem, esmerilado_fecha: e.target.value})} />
                        <InputGroup label="Cantidad Hojas" type="number" value={currentItem?.esmerilado_cantidad_hojas} onChange={e => setCurrentItem({...currentItem, esmerilado_cantidad_hojas: parseFloat(e.target.value)})} />
                        <InputGroup label="Costo por Hoja" type="number" value={currentItem?.esmerilado_costo_hoja} onChange={e => setCurrentItem({...currentItem, esmerilado_costo_hoja: parseFloat(e.target.value)})} />
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.esmerilado_estado} onValueChange={v => setCurrentItem({...currentItem, esmerilado_estado: v})}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent><SelectItem value="pendiente">Pendiente</SelectItem><SelectItem value="finalizado">Finalizado</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </div>
                    <InputGroup label="Observaciones" value={currentItem?.esmerilado_obs} onChange={e => setCurrentItem({...currentItem, esmerilado_obs: e.target.value})} />
                </TabsContent>
            </Tabs>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button type="submit">Guardar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent>
            <DialogHeader><DialogTitle>Detalle Acabado</DialogTitle></DialogHeader>
            {selectedItem && (
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 font-semibold text-lg border-b pb-2">
                        <span>Lote: {selectedItem.codigo_lote}</span>
                        <span className="text-right">Estado: {selectedItem.estado}</span>
                    </div>
                    {['abatanado', 'planchado', 'esmerilado'].map(section => (
                        <div key={section} className="bg-gray-50 p-3 rounded">
                            <h4 className="font-bold capitalize text-emerald-700">{section}</h4>
                            <div className="text-sm grid grid-cols-2 gap-1 mt-1">
                                <span>Estado: {selectedItem[`${section}_estado`] || 'N/A'}</span>
                                <span>Hojas: {selectedItem[`${section}_cantidad_hojas`] || 0}</span>
                                {section === 'abatanado' && <span>Tiempo: {selectedItem[`${section}_tiempo`] || 0} hrs</span>}
                                {section === 'planchado' && <span>Costo: {formatCurrency(selectedItem[`${section}_costo`] || 0)}</span>}
                                {section === 'esmerilado' && <span>Costo/Hoja: {formatCurrency(selectedItem[`${section}_costo_hoja`] || 0)}</span>}
                            </div>
                        </div>
                    ))}
                    <div className="text-right font-bold text-xl pt-2 border-t">
                        Total Costo Acabado: {formatCurrency(selectedItem.costo_total_acabado)}
                    </div>
                </div>
            )}
            <div className="flex justify-end pt-4"><Button onClick={() => setShowDetailModal(false)}>Cerrar</Button></div>
        </DialogContent>
      </Dialog>

      {showConsolidadoModal && (
          <LoteDetalleConsolidado 
              open={showConsolidadoModal}
              onOpenChange={setShowConsolidadoModal}
              codigoLote={loteConsolidado}
          />
      )}
    </div>
  );
}