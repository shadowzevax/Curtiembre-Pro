import React, { useState, useEffect, useRef } from 'react';
import { Proveedor, Cliente } from '@/entities/all';
import { UploadFile } from '@/integrations/Core';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, Search, Upload, FileText } from 'lucide-react';
import DataTable from '../components/common/DataTable';
import PageHeader from '../components/common/PageHeader';

export default function AdminTerceros() {
    const [proveedores, setProveedores] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [activeTab, setActiveTab] = useState('proveedores');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const [provData, cliData] = await Promise.all([
                Proveedor.list(),
                Cliente.list()
            ]);
            setProveedores(provData);
            setClientes(cliData);
        } catch (error) {
            console.error("Error loading data:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (item = null) => {
        setIsEditing(!!item);
        
        let nextCodigo = '';
        if (!item) {
            if (activeTab === 'proveedores') {
                const maxNum = proveedores.length > 0 
                    ? Math.max(...proveedores.map(p => {
                        const match = p.codigo?.match(/PROV-(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                    }))
                    : 0;
                nextCodigo = `PROV-${String(maxNum + 1).padStart(3, '0')}`;
            } else {
                const maxNum = clientes.length > 0 
                    ? Math.max(...clientes.map(c => {
                        const match = c.codigo?.match(/CLI-(\d+)/);
                        return match ? parseInt(match[1]) : 0;
                    }))
                    : 0;
                nextCodigo = `CLI-${String(maxNum + 1).padStart(3, '0')}`;
            }
        }
        
        setCurrentItem(item || {
            codigo: nextCodigo,
            tipo_tercero: activeTab === 'proveedores' ? 'proveedor' : 'cliente',
            tipo_persona: 'natural',
            tipo_identificacion: 'cedula',
            numero_identificacion: '',
            dv: '',
            nombre: '',
            nombre_comercial: '',
            pais: 'Colombia',
            departamento: '',
            ciudad: '',
            direccion: '',
            telefono: '',
            email: '',
            tipo: activeTab === 'proveedores' ? 'insumos' : 'productos',
            activo: true,
            rut: ''
        });
        setShowModal(true);
    };

    const handleOpenDetailModal = (item) => {
        setSelectedItem(item);
        setShowDetailModal(true);
    };

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            setCurrentItem(prev => ({ ...prev, rut: file_url }));
        } catch (error) {
            console.error("Error uploading file:", error);
            alert("Error al cargar el archivo RUT.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSave = async (e) => {
        e.preventDefault();
        const Entity = activeTab === 'proveedores' ? Proveedor : Cliente;
        const allItems = activeTab === 'proveedores' ? [...proveedores] : [...clientes];
        
        // Validar duplicados por número de identificación únicamente
        const isDuplicateId = allItems.some(item => 
            (item.numero_identificacion || item.nit) === (currentItem.numero_identificacion || currentItem.nit) &&
            (!isEditing || item.id !== currentItem.id)
        );

        if (isDuplicateId) {
            alert('PROVEEDOR O CLIENTE YA EXISTE REVISE');
            return;
        }

        try {
            const dataToSave = {
                ...currentItem,
                nit: currentItem.numero_identificacion
            };
            
            if (isEditing) {
                await Entity.update(currentItem.id, dataToSave);
            } else {
                await Entity.create(dataToSave);
            }
            setShowModal(false);
            loadData();
            alert("Tercero guardado con éxito.");
        } catch (error) {
            console.error("Error saving item:", error);
            alert("Error al guardar el tercero.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este tercero? Esta acción no se puede deshacer.')) return;
        const Entity = activeTab === 'proveedores' ? Proveedor : Cliente;
        try {
            await Entity.delete(id);
            loadData();
            alert("Tercero eliminado con éxito.");
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Error al eliminar el tercero.");
        }
    };

    const handleExport = () => {
        const dataToExport = activeTab === 'proveedores' ? proveedores : clientes;
        let csvContent = "ID,Nombre,Nombre Comercial,Tipo Tercero,Número ID,Telefono,Email,Tipo,Activo\n";
        csvContent += dataToExport.map(item =>
            `${item.id || ''},"${item.nombre || ''}","${item.nombre_comercial || ''}","${item.tipo_tercero || ''}","${item.numero_identificacion || item.nit || ''}","${item.telefono || ''}","${item.email || ''}","${item.tipo || ''}","${item.activo ? 'Sí' : 'No'}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handlePrint = () => window.print();

    const renderForm = () => (
        <form onSubmit={handleSave} onKeyDown={(e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); }} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div>
                <Label>Código</Label>
                <Input value={currentItem?.codigo || ''} readOnly className="bg-gray-100 font-mono font-bold" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Tipo de Tercero *</Label>
                    <Select value={currentItem?.tipo_tercero || ''} onValueChange={(value) => setCurrentItem({ ...currentItem, tipo_tercero: value })}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar tipo" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="cliente">Cliente</SelectItem>
                            <SelectItem value="proveedor">Proveedor</SelectItem>
                            <SelectItem value="transportador">Transportador</SelectItem>
                            <SelectItem value="trabajador">Trabajador</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Tipo de Persona *</Label>
                    <Select value={currentItem?.tipo_persona || 'natural'} onValueChange={(value) => setCurrentItem({ ...currentItem, tipo_persona: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="natural">Natural</SelectItem>
                            <SelectItem value="juridica">Jurídica</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Tipo de Identificación *</Label>
                    <Select value={currentItem?.tipo_identificacion || 'cedula'} onValueChange={(value) => setCurrentItem({ ...currentItem, tipo_identificacion: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="nit">NIT</SelectItem>
                            <SelectItem value="cedula">Cédula</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Número de Identificación *</Label>
                    <Input value={currentItem?.numero_identificacion || currentItem?.nit || ''} onChange={(e) => setCurrentItem({ ...currentItem, numero_identificacion: e.target.value })} required />
                </div>
                <div>
                    <Label>DV</Label>
                    <Input value={currentItem?.dv || ''} onChange={(e) => setCurrentItem({ ...currentItem, dv: e.target.value })} maxLength="1" />
                </div>
                <div>
                    <Label>Nombre Completo / Razón Social *</Label>
                    <Input value={currentItem?.nombre || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre: e.target.value })} required />
                </div>
                <div>
                    <Label>Nombre o Razón Comercial</Label>
                    <Input value={currentItem?.nombre_comercial || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre_comercial: e.target.value })} />
                </div>
                <div>
                    <Label>País</Label>
                    <Input value={currentItem?.pais || 'Colombia'} onChange={(e) => setCurrentItem({ ...currentItem, pais: e.target.value })} />
                </div>
                <div>
                    <Label>Departamento</Label>
                    <Input value={currentItem?.departamento || ''} onChange={(e) => setCurrentItem({ ...currentItem, departamento: e.target.value })} />
                </div>
                <div>
                    <Label>Ciudad/Municipio</Label>
                    <Input value={currentItem?.ciudad || ''} onChange={(e) => setCurrentItem({ ...currentItem, ciudad: e.target.value })} />
                </div>
            </div>
            <div>
                <Label>Dirección</Label>
                <Input value={currentItem?.direccion || ''} onChange={(e) => setCurrentItem({ ...currentItem, direccion: e.target.value })} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>No. Teléfono/Celular</Label>
                    <Input type="tel" value={currentItem?.telefono || ''} onChange={(e) => setCurrentItem({ ...currentItem, telefono: e.target.value })} />
                </div>
                <div>
                    <Label>Tipo *</Label>
                    <Select value={currentItem?.tipo || ''} onValueChange={(value) => setCurrentItem({ ...currentItem, tipo: value })} required>
                        <SelectTrigger><SelectValue placeholder="Seleccione un tipo" /></SelectTrigger>
                        <SelectContent>
                            {activeTab === 'proveedores' ? (
                                <>
                                    <SelectItem value="insumos">Insumos</SelectItem>
                                    <SelectItem value="pieles">Pieles</SelectItem>
                                    <SelectItem value="hojas">Hojas</SelectItem>
                                    <SelectItem value="servicios">Servicios</SelectItem>
                                </>
                            ) : (
                                <>
                                    <SelectItem value="productos">Productos</SelectItem>
                                    <SelectItem value="servicios">Servicios</SelectItem>
                                    <SelectItem value="ambos">Ambos</SelectItem>
                                </>
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Estado</Label>
                    <Select value={currentItem?.activo ? 'true' : 'false'} onValueChange={(value) => setCurrentItem({ ...currentItem, activo: value === 'true' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Activo</SelectItem>
                            <SelectItem value="false">Inactivo</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Correo Electrónico</Label>
                    <Input type="email" value={currentItem?.email || ''} onChange={(e) => setCurrentItem({ ...currentItem, email: e.target.value })} />
                </div>
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
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".pdf,.jpg,.jpeg,.png"/>
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current.click()} disabled={isUploading}>
                        {isUploading ? "Cargando..." : <><Upload className="w-4 h-4 mr-2"/>Cargar RUT</>}
                    </Button>
                </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit">Guardar</Button>
            </div>
        </form>
    );

    const filteredData = (data) => {
        if (!searchTerm) return data;
        return data.filter(item => 
            (item.numero_identificacion || item.nit || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.nombre_comercial || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    };

    const commonHeaders = ["Código", "Nombre", "Nombre Comercial", "Tipo Tercero", "No. Identificación", "Teléfono", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono font-bold">{item.codigo || 'N/A'}</td>
            <td>{item.nombre}</td>
            <td>{item.nombre_comercial}</td>
            <td><span className="capitalize">{item.tipo_tercero || (activeTab === 'proveedores' ? 'proveedor' : 'cliente')}</span></td>
            <td className="font-mono">{item.numero_identificacion || item.nit}</td>
            <td>{item.telefono}</td>
            <td><span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${item.activo ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.activo ? 'Activo' : 'Inactivo'}</span></td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenDetailModal(item)}><Eye className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(item.id)}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                </div>
            </td>
        </tr>
    );

    const renderTable = (data, isProveedorTab) => (
        <Card>
            <CardHeader>
                <CardTitle>Lista de {isProveedorTab ? 'Proveedores' : 'Clientes'}</CardTitle>
                <div className="flex gap-2 mt-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input 
                            placeholder="Buscar por NIT o Nombre..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <DataTable headers={commonHeaders} data={filteredData(data)} renderRow={renderRow} />
            </CardContent>
        </Card>
    );

    return (
        <div className="p-6">
             <style>{`
                .data-state-active\\:bg-emerald-600.data-state-active\\:text-white {
                    background-color: #059669 !important;
                    color: white !important;
                }
             `}</style>
            <PageHeader
                title="Administración de Terceros"
                description="Gestiona proveedores, clientes y otros terceros de la empresa."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Tercero
                    </Button>
                }
            />
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="proveedores" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Proveedores</TabsTrigger>
                    <TabsTrigger value="clientes" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Clientes</TabsTrigger>
                </TabsList>
                <TabsContent value="proveedores">
                    {renderTable(proveedores, true)}
                </TabsContent>
                <TabsContent value="clientes">
                    {renderTable(clientes, false)}
                </TabsContent>
            </Tabs>

            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Tercero</DialogTitle>
                    </DialogHeader>
                    {renderForm()}
                </DialogContent>
            </Dialog>

            <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Detalles de {selectedItem?.nombre}</DialogTitle>
                        <DialogDescription>Información completa del tercero.</DialogDescription>
                    </DialogHeader>
                    {selectedItem && (
                        <div className="space-y-2 text-sm">
                            <p><span className="font-semibold">Tipo Tercero:</span> <span className="capitalize">{selectedItem.tipo_tercero || 'N/A'}</span></p>
                            <p><span className="font-semibold">Tipo Persona:</span> <span className="capitalize">{selectedItem.tipo_persona || 'N/A'}</span></p>
                            <p><span className="font-semibold">Tipo Identificación:</span> <span className="uppercase">{selectedItem.tipo_identificacion || 'N/A'}</span></p>
                            <p><span className="font-semibold">Número Identificación:</span> {selectedItem.numero_identificacion || selectedItem.nit || 'N/A'}</p>
                            <p><span className="font-semibold">DV:</span> {selectedItem.dv || 'N/A'}</p>
                            <p><span className="font-semibold">Nombre:</span> {selectedItem.nombre}</p>
                            <p><span className="font-semibold">Nombre Comercial:</span> {selectedItem.nombre_comercial || 'N/A'}</p>
                            <p><span className="font-semibold">País:</span> {selectedItem.pais || 'N/A'}</p>
                            <p><span className="font-semibold">Departamento:</span> {selectedItem.departamento || 'N/A'}</p>
                            <p><span className="font-semibold">Ciudad:</span> {selectedItem.ciudad || 'N/A'}</p>
                            <p><span className="font-semibold">Dirección:</span> {selectedItem.direccion || 'N/A'}</p>
                            <p><span className="font-semibold">Teléfono:</span> {selectedItem.telefono || 'N/A'}</p>
                            <p><span className="font-semibold">Email:</span> {selectedItem.email || 'N/A'}</p>
                            <p><span className="font-semibold">Tipo:</span> {selectedItem.tipo}</p>
                            <p><span className="font-semibold">Estado:</span> {selectedItem.activo ? 'Activo' : 'Inactivo'}</p>
                            {selectedItem.rut && (
                                <p><span className="font-semibold">RUT:</span> <a href={selectedItem.rut} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Ver documento</a></p>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end pt-4">
                        <Button onClick={() => setShowDetailModal(false)}>Cerrar</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}