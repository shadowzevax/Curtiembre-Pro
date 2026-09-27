import React, { useState, useCallback } from 'react';
import ReporteBase from '../components/reportes/ReporteBase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ProductoTerminado, Insumo, MovimientoInventario, ProductoCatalogo } from '@/entities/all';
import { formatCOP, mensajeError } from '../components/finanzas/utils';

const GRUPOS = [
  { value: '__todos', label: 'Todo el inventario' },
  { value: 'pieles', label: 'Materia prima (pieles)' },
  { value: 'producto_terminado', label: 'Productos terminados' },
  { value: 'insumos', label: 'Insumos y químicos' },
];

// "Inventario Valorizado" (requerimiento 6.16): existencia × costo promedio de cada ítem.
// Reutiliza exactamente el mismo cálculo de stock_actual (suma de MovimientoInventario) que
// usan las pantallas de Inventarios en vivo, para no mostrar un número distinto al real.
export default function ReporteInventarioValorizado() {
  const [grupo, setGrupo] = useState('__todos');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  const consultar = useCallback(async () => {
    setCargando(true); setError('');
    try {
      const [productos, insumos, movimientos, catalogo] = await Promise.all([
        ProductoTerminado.list(), Insumo.list(), MovimientoInventario.list(), ProductoCatalogo.list(),
      ]);
      const stockDe = (id) => movimientos.filter((m) => m.insumo_id === id).reduce((s, m) => s + (parseFloat(m.cantidad) || 0), 0);

      const filasProductos = productos
        .filter((p) => grupo === '__todos' || grupo === p.categoria)
        .map((p) => ({ id: p.id, codigo: p.codigo, descripcion: p.descripcion, categoria: p.categoria === 'pieles' ? 'Materia prima' : 'Producto terminado',
          unidad_medida: p.unidad_medida, stock: stockDe(p.id), costo_promedio: parseFloat(p.costo_promedio) || 0 }));

      const filasInsumos = (grupo === '__todos' || grupo === 'insumos') ? insumos.map((i) => {
        const cat = catalogo.find((c) => c.codigo === i.codigo);
        return { id: i.id, codigo: i.codigo, descripcion: cat?.descripcion || i.descripcion || i.nombre, categoria: 'Insumo/Químico',
          unidad_medida: i.unidad_medida, stock: stockDe(i.id), costo_promedio: parseFloat(i.costo_promedio) || 0 };
      }) : [];

      const filas = [...filasProductos, ...filasInsumos]
        .map((f) => ({ ...f, valor_total: f.stock * f.costo_promedio }))
        .filter((f) => f.stock !== 0)
        .sort((a, b) => b.valor_total - a.valor_total);

      const columnas = [
        { key: 'codigo', label: 'Código' },
        { key: 'descripcion', label: 'Descripción', ancho: 2 },
        { key: 'categoria', label: 'Categoría' },
        { key: 'stock', label: 'Existencia', align: 'right' },
        { key: 'unidad_medida', label: 'Unidad' },
        { key: 'costo_promedio', label: 'Costo promedio', align: 'right', render: formatCOP },
        { key: 'valor_total', label: 'Valor total', align: 'right', render: formatCOP },
      ];
      setResultado({ columnas, filas, totales: { valor_total: filas.reduce((s, f) => s + f.valor_total, 0) } });
    } catch (e) { setError(mensajeError(e)); setResultado(null); } finally { setCargando(false); }
  }, [grupo]);

  return (
    <ReporteBase
      titulo="Inventario Valorizado"
      descripcion="Existencia actual por costo promedio de cada ítem, sin modificar el módulo de Inventarios."
      filtrosTexto={GRUPOS.find((g) => g.value === grupo)?.label}
      cargando={cargando}
      resultado={resultado}
      onConsultar={consultar}
      filtros={<>
        {error && <p className="text-xs text-red-600 w-full">{error}</p>}
        <div><Label>Grupo</Label>
          <Select value={grupo} onValueChange={setGrupo}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{GRUPOS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </>}
    />
  );
}
