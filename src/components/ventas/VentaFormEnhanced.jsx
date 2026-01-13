import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReciboCaja, AsientoContable, CuentaBancaria, Caja, CuentaContable } from '@/entities/all';

export default function VentaFormEnhanced({ venta, onAfterSave }) {
    const [cajas, setCajas] = useState([]);
    const [cuentas, setCuentas] = useState([]);

    useEffect(() => {
        loadCuentas();
    }, []);

    const loadCuentas = async () => {
        try {
            const [cajasData, bancosData] = await Promise.all([
                Caja.list(),
                CuentaBancaria.list()
            ]);
            setCajas(cajasData);
            setCuentas(bancosData);
        } catch (error) {
            console.error('Error loading accounts:', error);
        }
    };

    // Generar recibo de caja automático para ventas de contado
    const generarReciboCaja = async (ventaData) => {
        if (ventaData.forma_pago === 'contado' && ventaData.monto_efectivo > 0) {
            try {
                // Generar consecutivo
                const lastRecibos = await ReciboCaja.list('-created_date', 1);
                const nextNum = lastRecibos.length > 0 ? parseInt(lastRecibos[0].numero_recibo || '0') + 1 : 1;

                await ReciboCaja.create({
                    numero_recibo: String(nextNum).padStart(6, '0'),
                    fecha: ventaData.fecha_orden,
                    tipo_ingreso: 'venta',
                    tercero_id: ventaData.cliente_id,
                    tercero_nombre: ventaData.cliente_nombre || '',
                    concepto: `Venta ${ventaData.prefijo_documento}-${ventaData.numero_documento}`,
                    valor: ventaData.monto_efectivo,
                    medio_pago: ventaData.medio_pago || 'efectivo',
                    cuenta_destino_id: ventaData.cuenta_destino_id || '',
                    cuenta_destino_nombre: ventaData.cuenta_destino_nombre || 'Caja Principal',
                    venta_id: ventaData.id,
                    generado_automaticamente: true
                });

                console.log('✅ Recibo de caja generado automáticamente');
            } catch (error) {
                console.error('Error generando recibo de caja:', error);
            }
        }
    };

    // Generar asiento contable
    const generarAsientoContable = async (ventaData) => {
        try {
            const lastAsientos = await AsientoContable.list('-created_date', 1);
            const nextNum = lastAsientos.length > 0 ? parseInt(lastAsientos[0].numero_asiento || '0') + 1 : 1;

            const detalle = [
                {
                    cuenta_codigo: ventaData.forma_pago === 'contado' ? '1105' : '1305',
                    cuenta_nombre: ventaData.forma_pago === 'contado' ? 'Caja' : 'Cuentas por Cobrar',
                    debe: ventaData.total,
                    haber: 0,
                    tercero_id: ventaData.cliente_id,
                    tercero_nombre: ventaData.cliente_nombre || ''
                },
                {
                    cuenta_codigo: '4135',
                    cuenta_nombre: 'Ingresos por Ventas',
                    debe: 0,
                    haber: ventaData.total,
                    tercero_id: ventaData.cliente_id,
                    tercero_nombre: ventaData.cliente_nombre || ''
                }
            ];

            await AsientoContable.create({
                numero_asiento: String(nextNum).padStart(6, '0'),
                fecha: ventaData.fecha_orden,
                tipo_asiento: 'movimiento',
                descripcion: `Venta ${ventaData.prefijo_documento}-${ventaData.numero_documento}`,
                origen_modulo: 'ventas',
                referencia_origen_id: ventaData.id,
                detalle,
                total_debe: ventaData.total,
                total_haber: ventaData.total,
                estado: 'contabilizado'
            });

            console.log('✅ Asiento contable generado automáticamente');
        } catch (error) {
            console.error('Error generando asiento:', error);
        }
    };

    return { generarReciboCaja, generarAsientoContable };
}