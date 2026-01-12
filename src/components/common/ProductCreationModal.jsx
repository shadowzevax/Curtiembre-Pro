import React, { useState, useEffect } from 'react';
import { ProductoCatalogo, UnidadMedida, Insumo, ProductoTerminado } from '@/entities/all';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

export default function ProductCreationModal({ open, onOpenChange, onSuccess, initialCode = "", initialDescription = "" }) {
    const [formData, setFormData] = useState({
        codigo: "",
        descripcion: "",
        unidad_medida: "",
        categoria: "materia_prima",
        maneja_inventario: true,
        stock_minimo: 0,
        stock_maximo: 0,
        costo_estandar: 0,
        estado: "activo"
    });
    const [unidades, setUnidades] = useState([]);

    useEffect(() => {
        if (open) {
            setFormData(prev => ({
                ...prev,
                codigo: initialCode || "",
                descripcion: initialDescription || ""
            }));
            loadUnidades();
        }
    }, [open, initialCode, initialDescription]);

    const loadUnidades = async () => {
        try {
            const units = await UnidadMedida.list();
            setUnidades(units);
        } catch (error) {
            console.error("Error loading units:", error);
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // 1. Crear en Catálogo
            const newProduct = await ProductoCatalogo.create(formData);
            
            // 2. Crear en Inventario correspondiente según Categoría
            const commonData = {
                codigo: formData.codigo,
                nombre: formData.descripcion, // Nombre corto
                descripcion: formData.descripcion,
                unidad_medida: formData.unidad_medida,
                stock_minimo: formData.stock_minimo,
                stock_actual: 0,
                costo_promedio: formData.costo_estandar || 0,
                activo: formData.estado === 'activo'
            };

            if (formData.categoria === 'materia_prima') {
                await Insumo.create({
                    ...commonData,
                    categoria: 'pieles' // Default subcategory within Insumo, or we map broadly
                });
            } else if (formData.categoria === 'insumos_quimicos') {
                await Insumo.create({
                    ...commonData,
                    categoria: 'quimicos'
                });
            } else if (formData.categoria === 'productos_terminados') {
                await ProductoTerminado.create({
                    ...commonData,
                    categoria: 'pieles', // Default subcategory
                    precio_venta_1: 0,
                    precio_venta_2: 0
                });
            }

            alert("Producto creado exitosamente en el catálogo y en el inventario correspondiente.");
            onSuccess(newProduct);
            onOpenChange(false);
        } catch (error) {
            console.error("Error creating product:", error);
            alert("Error al crear el producto.");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Crear Nuevo Producto en Catálogo</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Código *</Label>
                            <Input value={formData.codigo} onChange={e => handleChange('codigo', e.target.value)} required />
                        </div>
                        <div>
                            <Label>Categoría *</Label>
                            <Select value={formData.categoria} onValueChange={v => handleChange('categoria', v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="materia_prima">Materia Prima</SelectItem>
                                    <SelectItem value="insumos_quimicos">Insumos Químicos</SelectItem>
                                    <SelectItem value="productos_terminados">Productos Terminados</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label>Descripción *</Label>
                        <Textarea value={formData.descripcion} onChange={e => handleChange('descripcion', e.target.value)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Unidad de Medida *</Label>
                            <Select value={formData.unidad_medida} onValueChange={v => handleChange('unidad_medida', v)}>
                                <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                                <SelectContent>
                                    {unidades.map(u => (
                                        <SelectItem key={u.id} value={u.abreviatura}>{u.nombre} ({u.abreviatura})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Costo Estándar</Label>
                            <Input type="number" value={formData.costo_estandar} onChange={e => handleChange('costo_estandar', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <Label>Stock Mínimo</Label>
                            <Input type="number" value={formData.stock_minimo} onChange={e => handleChange('stock_minimo', parseFloat(e.target.value) || 0)} />
                        </div>
                        <div>
                            <Label>Stock Máximo</Label>
                            <Input type="number" value={formData.stock_maximo} onChange={e => handleChange('stock_maximo', parseFloat(e.target.value) || 0)} />
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Checkbox id="inv" checked={formData.maneja_inventario} onCheckedChange={v => handleChange('maneja_inventario', v)} />
                        <Label htmlFor="inv">Maneja Inventario</Label>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                        <Button type="submit">Guardar Producto</Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}