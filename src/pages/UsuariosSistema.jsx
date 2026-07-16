import React, { useState, useEffect, useCallback } from 'react';
import { User } from '@/entities/User';
import PageHeader from '../components/common/PageHeader';
import DataTable from '../components/common/DataTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function UsuariosSistema() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [currentItem, setCurrentItem] = useState(null);

    const loadUsers = useCallback(async () => {
        setLoading(true);
        try {
            const usersData = await User.list();
            setUsers(usersData);
        } catch (error) {
            console.error("Error loading users:", error);
            alert("No se pudieron cargar los usuarios.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const handleOpenModal = (user = null) => {
        setIsEditing(!!user);
        setCurrentItem(user || { full_name: '', email: '', role: 'operario', password: '' });
        setShowModal(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            if (isEditing) {
                // La API de usuarios puede que no permita cambiar el email o contraseña directamente así.
                // Esta es una representación. La lógica real depende de la API.
                await User.update(currentItem.id, {
                    full_name: currentItem.full_name,
                    role: currentItem.role
                });
            } else {
                await User.create({
                    full_name: currentItem.full_name,
                    email: currentItem.email,
                    role: currentItem.role,
                    password: currentItem.password
                });
            }
            setShowModal(false);
            loadUsers();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    };
    
    const handleDelete = async (userId) => {
        if(window.confirm("¿Está seguro de eliminar este usuario?")) {
            try {
                await User.delete(userId);
                alert("Usuario eliminado.");
                loadUsers();
            } catch (error) {
                alert(`Error al eliminar: ${error.message}`);
            }
        }
    };
    
    const handleExport = () => alert("Función de exportar en desarrollo.");
    const handlePrint = () => window.print();

    const headers = ["Nombre Completo", "Email", "Rol", "Acciones"];
    const renderRow = (user) => (
        <tr key={user.id}>
            <td>{user.full_name}</td>
            <td>{user.email}</td>
            <td>{user.role}</td>
            <td>
                <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleOpenModal(user)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(user.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
            </td>
        </tr>
    );

    return (
        <div className="p-6">
            <PageHeader
                title="Usuarios del Sistema"
                description="Gestiona los usuarios y sus roles dentro de la aplicación."
                onExportExcel={handleExport}
                onPrint={handlePrint}
                actionButton={
                    <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                        <Plus className="w-4 h-4 mr-2" /> Nuevo Usuario
                    </Button>
                }
            />
            <Card id="tabla-imprimible">
                <CardHeader>
                    <CardTitle>Lista de Usuarios</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable headers={headers} data={users} renderRow={renderRow} loading={loading} />
                </CardContent>
            </Card>
            <Dialog open={showModal} onOpenChange={setShowModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{isEditing ? 'Editar' : 'Nuevo'} Usuario</DialogTitle>
                        <DialogDescription>
                            {isEditing ? 'Modifique los detalles del usuario.' : 'Crea un usuario con email y contraseña.'}
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSave} className="space-y-4 pt-4">
                        <div>
                            <Label htmlFor="full_name">Nombre Completo</Label>
                            <Input id="full_name" value={currentItem?.full_name || ''} onChange={(e) => setCurrentItem({ ...currentItem, full_name: e.target.value })} required />
                        </div>
                        <div>
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" value={currentItem?.email || ''} onChange={(e) => setCurrentItem({ ...currentItem, email: e.target.value })} required disabled={isEditing} />
                        </div>
                        <div>
                            <Label htmlFor="role">Rol</Label>
                            <Select value={currentItem?.role || 'operario'} onValueChange={(value) => setCurrentItem({ ...currentItem, role: value })}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="admin">Admin</SelectItem>
                                    <SelectItem value="contador">Contador</SelectItem>
                                    <SelectItem value="operario">Operario</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {!isEditing && (
                            <div>
                                <Label htmlFor="password">Contraseña</Label>
                                <Input id="password" type="password" value={currentItem?.password || ''} onChange={(e) => setCurrentItem({ ...currentItem, password: e.target.value })} required minLength={6}/>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
                            <Button type="submit">Guardar Cambios</Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}