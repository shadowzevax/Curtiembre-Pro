import React, { useState, useEffect, useRef } from 'react';
import { Tercero } from '@/entities/all';
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
    const [terceros, setTerceros] = useState([]);
    const [activeTab, setActiveTab] = useState('proveedores');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const fileInputRef = useRef(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await Tercero.list();
            setTerceros(data);
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
            const maxNum = terceros.length > 0 
                ? Math.max(...terceros.map(t => {
                    const match = t.codigo?.match(/TER-(\d+)/);
                    return match ? parseInt(match[1]) : 0;
                }))
                : 0;
            nextCodigo = `TER-${String(maxNum + 1).padStart(3, '0')}`;
        }
        
        setCurrentItem(item || {
            codigo: nextCodigo,
            es_cliente: activeTab === 'clientes',
            es_proveedor: activeTab === 'proveedores',
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
            activo: true,
            fecha_creacion: new Date().toISOString().split('T')[0],
            regimen_tributario: 'regimen_ordinario',
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
        
        // Validar duplicados por número de identificación
        const isDuplicateId = terceros.some(item => 
            (item.numero_identificacion || item.nit) === (currentItem.numero_identificacion || currentItem.nit) &&
            (!isEditing || item.id !== currentItem.id)
        );

        if (isDuplicateId) {
            alert('TERCERO YA EXISTE CON ESTE NÚMERO DE IDENTIFICACIÓN');
            return;
        }

        try {
            const dataToSave = {
                ...currentItem,
                nit: currentItem.numero_identificacion
            };
            
            if (isEditing) {
                await Tercero.update(currentItem.id, dataToSave);
            } else {
                await Tercero.create(dataToSave);
            }
            setShowModal(false);
            loadData();
            alert("✅ Tercero guardado con éxito.");
        } catch (error) {
            console.error("Error saving item:", error);
            alert("Error al guardar el tercero.");
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('¿Está seguro de que desea eliminar este tercero? Esta acción no se puede deshacer.')) return;
        try {
            await Tercero.delete(id);
            loadData();
            alert("Tercero eliminado con éxito.");
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Error al eliminar el tercero.");
        }
    };

    const getFilteredData = () => {
        if (filtroTipo === 'todos') return terceros;
        if (filtroTipo === 'clientes') return terceros.filter(t => t.es_cliente);
        if (filtroTipo === 'proveedores') return terceros.filter(t => t.es_proveedor);
        return terceros;
    };
    
    const handleExport = () => {
        const dataToExport = getFilteredData();
        let csvContent = "Código,Nombre,Nombre Comercial,Tipo Tercero,Número ID,Teléfono,Email,Es Cliente,Es Proveedor,Activo,Fecha Creación,Régimen Tributario\n";
        csvContent += dataToExport.map(item =>
            `${item.codigo || ''},"${item.nombre || ''}","${item.nombre_comercial || ''}","${item.tipo_tercero || ''}","${item.numero_identificacion || item.nit || ''}","${item.telefono || ''}","${item.email || ''}","${item.es_cliente ? 'Sí' : 'No'}","${item.es_proveedor ? 'Sí' : 'No'}","${item.activo ? 'Sí' : 'No'}","${item.fecha_creacion || ''}","${item.regimen_tributario || ''}"`
        ).join("\n");

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `terceros_${new Date().toISOString().slice(0, 10)}.csv`);
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
                    <Label>Nombre Comercial</Label>
                    <Input value={currentItem?.nombre_comercial || ''} onChange={(e) => setCurrentItem({ ...currentItem, nombre_comercial: e.target.value })} />
                </div>
                <div>
                    <Label>Es Cliente</Label>
                    <Select value={currentItem?.es_cliente ? 'si' : 'no'} onValueChange={(value) => setCurrentItem({ ...currentItem, es_cliente: value === 'si' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="si">Sí</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Es Proveedor</Label>
                    <Select value={currentItem?.es_proveedor ? 'si' : 'no'} onValueChange={(value) => setCurrentItem({ ...currentItem, es_proveedor: value === 'si' })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="si">Sí</SelectItem>
                            <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                    </Select>
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
                    <Label>Correo Electrónico</Label>
                    <Input type="email" value={currentItem?.email || ''} onChange={(e) => setCurrentItem({ ...currentItem, email: e.target.value })} />
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
                    <Label>Fecha de Creación</Label>
                    <Input type="date" value={currentItem?.fecha_creacion || ''} onChange={(e) => setCurrentItem({ ...currentItem, fecha_creacion: e.target.value })} />
                </div>
                <div>
                    <Label>Régimen Tributario</Label>
                    <Select value={currentItem?.regimen_tributario || 'regimen_ordinario'} onValueChange={(value) => setCurrentItem({ ...currentItem, regimen_tributario: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="regimen_ordinario">Régimen Ordinario (o Común)</SelectItem>
                            <SelectItem value="regimen_simple">Régimen Simple de Tributación</SelectItem>
                            <SelectItem value="regimen_especial">Régimen Tributario Especial</SelectItem>
                        </SelectContent>
                    </Select>
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

    const filteredData = () => {
        let data = getFilteredData();
        
        // Filtrar por tab activo
        if (activeTab === 'proveedores') {
            data = data.filter(t => t.es_proveedor);
        } else if (activeTab === 'clientes') {
            data = data.filter(t => t.es_cliente);
        }
        
        // Filtrar por búsqueda
        if (searchTerm) {
            data = data.filter(item => 
                (item.numero_identificacion || item.nit || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.nombre_comercial || '').toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        return data;
    };

    const commonHeaders = ["Código", "Nombre", "Nombre Comercial", "No. Identificación", "Teléfono", "Cliente", "Proveedor", "Estado", "Acciones"];
    const renderRow = (item) => (
        <tr key={item.id}>
            <td className="font-mono font-bold">{item.codigo || 'N/A'}</td>
            <td>{item.nombre}</td>
            <td>{item.nombre_comercial || '-'}</td>
            <td className="font-mono">{item.numero_identificacion || item.nit}</td>
            <td>{item.telefono}</td>
            <td><span className={`px-2 py-1 rounded text-xs ${item.es_cliente ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>{item.es_cliente ? 'Sí' : 'No'}</span></td>
            <td><span className={`px-2 py-1 rounded text-xs ${item.es_proveedor ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>{item.es_proveedor ? 'Sí' : 'No'}</span></td>
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

    const renderTable = () => (
        <Card>
            <CardHeader>
                <CardTitle>Lista de Terceros</CardTitle>
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
                    <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                        <SelectTrigger className="w-48">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="clientes">Solo Clientes</SelectItem>
                            <SelectItem value="proveedores">Solo Proveedores</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <DataTable headers={commonHeaders} data={filteredData()} renderRow={renderRow} />
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
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="todos" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Todos</TabsTrigger>
                    <TabsTrigger value="proveedores" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Proveedores</TabsTrigger>
                    <TabsTrigger value="clientes" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">Clientes</TabsTrigger>
                </TabsList>
                <TabsContent value="todos">
                    {renderTable()}
                </TabsContent>
                <TabsContent value="proveedores">
                    {renderTable()}
                </TabsContent>
                <TabsContent value="clientes">
                    {renderTable()}
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