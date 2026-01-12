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
        setCurrentItem(item || { 
            nombre_completo: '', 
            cedula: '', 
            fecha_nacimiento: '',
            direccion: '',
            telefono: '',
            email: '',
            cargo: '', 
            fecha_contratacion: new Date().toISOString().split('T')[0], 
            salario: 0, 
            estado: 'activo',
            rut: '',
            foto: ''
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

    const headers = ["Foto", "Nombre", "Cédula", "Cargo", "Salario", "Fecha Nacimiento", "Estado", "RUT", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td>
                {item.foto ? (
                    <img src={item.foto} alt={item.nombre_completo} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                        <ImageIcon className="w-5 h-5 text-gray-400" />
                    </div>
                )}
            </td>
            <td>{item.nombre_completo}</td>
            <td>{item.cedula}</td>
            <td>{item.cargo}</td>
            <td>{formatCurrency(item.salario)}</td>
            <td>{formatDate(item.fecha_nacimiento)}</td>
            <td><span className={`px-2 py-1 rounded-full text-xs font-semibold ${item.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.estado}</span></td>
            <td>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handlePrintRut(item.rut)} 
                    disabled={!item.rut}
                    title={item.rut ? "Ver/Imprimir RUT" : "Sin RUT"}
                >
                    <FileText className={`w-4 h-4 ${item.rut ? 'text-blue-600' : 'text-gray-300'}`} />
                </Button>
            </td>
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
                title="Gestión de Empleados"
                description="Administra la información de los empleados de la empresa."
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
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Empleado</DialogTitle>
                    </DialogHeader>
                     <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Nombre Completo *</Label>
                                <Input value={currentItem?.nombre_completo || ''} onChange={e => setCurrentItem({...currentItem, nombre_completo: e.target.value})} required/>
                            </div>
                            <div>
                                <Label>Cédula *</Label>
                                <Input value={currentItem?.cedula || ''} onChange={e => setCurrentItem({...currentItem, cedula: e.target.value})} required/>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Fecha de Nacimiento</Label>
                                <Input type="date" value={currentItem?.fecha_nacimiento || ''} onChange={e => setCurrentItem({...currentItem, fecha_nacimiento: e.target.value})} />
                            </div>
                            <div>
                                <Label>Dirección</Label>
                                <Input value={currentItem?.direccion || ''} onChange={e => setCurrentItem({...currentItem, direccion: e.target.value})} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>Teléfono/Celular</Label>
                                <Input value={currentItem?.telefono || ''} onChange={e => setCurrentItem({...currentItem, telefono: e.target.value})} />
                            </div>
                            <div>
                                <Label>Correo Electrónico</Label>
                                <Input type="email" value={currentItem?.email || ''} onChange={e => setCurrentItem({...currentItem, email: e.target.value})} />
                            </div>
                        </div>
                        <div>
                            <Label>Máquinas o Proceso Asignados *</Label>
                            <Input value={currentItem?.cargo || ''} onChange={e => setCurrentItem({...currentItem, cargo: e.target.value})} required placeholder="Ej: Máquina de Curtido, Proceso de Acabado"/>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <Label>Fecha de Contratación *</Label>
                                <Input type="date" value={currentItem?.fecha_contratacion || ''} onChange={e => setCurrentItem({...currentItem, fecha_contratacion: e.target.value})} required/>
                            </div>
                            <div>
                                <Label>Salario *</Label>
                                <Input type="number" value={currentItem?.salario || ''} onChange={e => setCurrentItem({...currentItem, salario: parseFloat(e.target.value) || 0})} required/>
                            </div>
                        </div>
                        <div>
                            <Label>Estado</Label>
                            <Select value={currentItem?.estado || 'activo'} onValueChange={v => setCurrentItem({...currentItem, estado: v})}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="activo">Activo</SelectItem>
                                    <SelectItem value="inactivo">Inactivo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>RUT (Registro Único Tributario)</Label>
                            <div className="flex gap-2 items-end">
                                <div className="flex-grow">
                                    {currentItem?.rut && (
                                        <a href={currentItem.rut} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                                            <FileText className="w-4 h-4" />
                                            Ver RUT actual
                                        </a>
                                    )}
                                </div>
                                <input type="file" ref={rutInputRef} onChange={(e) => handleFileChange(e, 'rut')} className="hidden" accept=".pdf,.jpg,.jpeg,.png"/>
                                <Button type="button" variant="outline" size="sm" onClick={() => rutInputRef.current.click()} disabled={isUploadingRut}>
                                    {isUploadingRut ? "Cargando..." : <><Upload className="w-4 h-4 mr-2"/>Cargar RUT</>}
                                </Button>
                            </div>
                        </div>
                        <div>
                            <Label>Foto del Empleado</Label>
                            <div className="flex gap-2 items-center">
                                {currentItem?.foto && (
                                    <img src={currentItem.foto} alt="Vista previa" className="w-20 h-20 rounded-full object-cover border-2 border-gray-200" />
                                )}
                                <div className="flex-grow">
                                    <input type="file" ref={fotoInputRef} onChange={(e) => handleFileChange(e, 'foto')} className="hidden" accept="image/*"/>
                                    <Button type="button" variant="outline" size="sm" onClick={() => fotoInputRef.current.click()} disabled={isUploadingFoto}>
                                        {isUploadingFoto ? "Cargando..." : <><ImageIcon className="w-4 h-4 mr-2"/>Cargar Foto</>}
                                    </Button>
                                </div>
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