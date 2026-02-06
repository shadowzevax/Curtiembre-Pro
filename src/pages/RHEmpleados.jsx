import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Empleado } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2, FileText, Upload, Image as ImageIcon } from 'lucide-react';

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const userTimezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() + userTimezoneOffset).toLocaleDateString('es-CO');
};

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function RHEmpleados() {
    const [empleados, setEmpleados] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUploadingRut, setIsUploadingRut] = useState(false);
    const [isUploadingFoto, setIsUploadingFoto] = useState(false);
    const rutInputRef = useRef(null);
    const fotoInputRef = useRef(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await Empleado.list();
            setEmpleados(data);
        } catch (error) { console.error("Error:", error); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);
    
    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        
        let nextCodigo = 'PER-001';
        if (!item && empleados.length > 0) {
            const maxNum = Math.max(...empleados.map(e => {
                const match = e.codigo_personal?.match(/PER-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }));
            nextCodigo = `PER-${String(maxNum + 1).padStart(3, '0')}`;
        }
        
        setCurrentItem(item || { 
            codigo_personal: nextCodigo,
            nombre: '', 
            identificacion: '', 
            telefono: '',
            email: '',
            tipo_personal: 'operario',
            cargo: '', 
            direccion: '',
            estado: 'activo',
            observaciones: ''
        });
        setShowModal(true);
    };

    const handleFileChange = async (event, tipo) => {
        const file = event.target.files[0];
        if (!file) return;
        
        if (tipo === 'rut') {
            setIsUploadingRut(true);
        } else {
            setIsUploadingFoto(true);
        }
        
        try {
            const { file_url } = await UploadFile({ file });
            setCurrentItem(prev => ({ ...prev, [tipo]: file_url }));
        } catch (error) {
            console.error("Error uploading file:", error);
            alert(`Error al cargar ${tipo === 'rut' ? 'el RUT' : 'la foto'}.`);
        } finally {
            if (tipo === 'rut') {
                setIsUploadingRut(false);
            } else {
                setIsUploadingFoto(false);
            }
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                await Empleado.update(currentItem.id, currentItem);
            } else {
                await Empleado.create(currentItem);
            }
            setShowModal(false);
            loadData();
            alert("Empleado guardado con éxito.");
        } catch (error) { 
            console.error("Error:", error);
            alert("Error al guardar."); 
        }
    };
    
    const handleDelete = async (id) => {
        if (confirm("¿Eliminar este empleado?")) {
            try {
                await Empleado.delete(id);
                loadData();
                alert("Empleado eliminado.");
            } catch (error) {
                alert("Error al eliminar.");
            }
        }
    };

    const handlePrintRut = (rut) => {
        if (!rut) {
            alert("Este empleado no tiene RUT cargado.");
            return;
        }
        window.open(rut, '_blank');
    };
    
    const handleExport = () => {
        let csvContent = "Nombre,Cédula,Fecha Nacimiento,Cargo,Fecha Contratación,Salario,Estado\n";
        csvContent += empleados.map(emp =>
            `"${emp.nombre_completo}","${emp.cedula}","${formatDate(emp.fecha_nacimiento)}","${emp.cargo}","${formatDate(emp.fecha_contratacion)}","${emp.salario}","${emp.estado}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `empleados_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handlePrint = () => window.print();

    const headers = ["Código", "Nombre", "Identificación", "Tipo Personal", "Cargo", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono font-bold">{item.codigo_personal}</td>
            <td>{item.nombre}</td>
            <td className="font-mono">{item.identificacion}</td>
            <td className="capitalize">{item.tipo_personal}</td>
            <td>{item.cargo}</td>
            <td><span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <style>{`@media print {#tabla-imprimible { position: absolute; left: 0; top: 0; width: 100%; } #page-header, .no-print { display: none; } body * { visibility: hidden; } #tabla-imprimible, #tabla-imprimible * { visibility: visible; }}`}</style>
            <PageHeader 
                title="Personal"
                description="Administra la información del personal de la empresa."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Empleado
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader><CardTitle>Lista de Empleados</CardTitle></CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={empleados} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                       <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Personal</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                       <div>
                           <Label>Código Personal</Label>
                           <Input value={currentItem?.codigo_personal || ''} readOnly className="bg-gray-100 font-mono font-bold" />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <Label>Nombre Completo *</Label>
                               <Input value={currentItem?.nombre || ''} onChange={e => setCurrentItem({...currentItem, nombre: e.target.value})} required/>
                           </div>
                           <div>
                               <Label>Identificación *</Label>
                               <Input value={currentItem?.identificacion || ''} onChange={e => setCurrentItem({...currentItem, identificacion: e.target.value})} required/>
                           </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <Label>Teléfono</Label>
                               <Input value={currentItem?.telefono || ''} onChange={e => setCurrentItem({...currentItem, telefono: e.target.value})} />
                           </div>
                           <div>
                               <Label>Correo Electrónico</Label>
                               <Input type="email" value={currentItem?.email || ''} onChange={e => setCurrentItem({...currentItem, email: e.target.value})} />
                           </div>
                       </div>
                       <div>
                           <Label>Tipo de Personal *</Label>
                           <Select value={currentItem?.tipo_personal || 'operario'} onValueChange={v => setCurrentItem({...currentItem, tipo_personal: v})}>
                               <SelectTrigger><SelectValue/></SelectTrigger>
                               <SelectContent>
                                   <SelectItem value="operario">OPERARIO</SelectItem>
                                   <SelectItem value="ayudante">AYUDANTE</SelectItem>
                                   <SelectItem value="ocasional">OCASIONAL</SelectItem>
                               </SelectContent>
                           </Select>
                       </div>
                       <div>
                           <Label>Cargo/Proceso Asignado</Label>
                           <Input value={currentItem?.cargo || ''} onChange={e => setCurrentItem({...currentItem, cargo: e.target.value})} placeholder="Ej: Curtidor, Operario de Acabado"/>
                       </div>
                       <div>
                           <Label>Dirección</Label>
                           <Input value={currentItem?.direccion || ''} onChange={e => setCurrentItem({...currentItem, direccion: e.target.value})} />
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                           <div>
                               <Label>Estado</Label>
                               <Select value={currentItem?.estado || 'activo'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                   <SelectTrigger><SelectValue/></SelectTrigger>
                                   <SelectContent>
                                       <SelectItem value="activo">ACTIVO</SelectItem>
                                       <SelectItem value="inactivo">INACTIVO</SelectItem>
                                   </SelectContent>
                               </Select>
                           </div>
                           <div>
                               <Label>Observaciones</Label>
                               <Input value={currentItem?.observaciones || ''} onChange={e => setCurrentItem({...currentItem, observaciones: e.target.value})} />
                           </div>
                       </div>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}