import React, { useState, useEffect } from 'react';
import { PedidoMarroquinero, ColorPintura } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Save } from 'lucide-react';
import NumericInput from '../components/common/NumericInput';

const COLORES_PREDEFINIDOS = [
  'AGUA MARINA', 'AGUA MARINA PASTEL', 'ALMENDRA', 'AMARILLO INTENSO', 'AMARILLO PASTEL',
  'ARENA PASTEL', 'AZUL CLARO', 'AZUL ELECTRICO', 'AZUL ESCARCHA', 'AZUL ETER',
  'AZUL GRISACEO', 'AZUL NOCHE', 'AZUL REY', 'BALSO', 'BEIGE CLARO', 'BEIGE OSCURO',
  'BERENGENA', 'BLANCO', 'BRONCE', 'CAFE CLARO', 'CAFE OSCURO', 'CAQUI', 'CARAMELO',
  'CHAMPAÑA', 'CIELO PASTEL', 'COBRE', 'CREMA', 'DORADO MATE', 'DORADDO MEDIO',
  'FUCCIA CLARO', 'FUCCIA OSCURO BAMBI', 'FUSIL', 'INDIGO', 'LILA LECHE', 'LILA PASTEL',
  'MARFIL', 'MARINO', 'MENTA', 'MIEL CLARO', 'MIEL MAPLE', 'MIEL OSCURO', 'MORA PASTEL',
  'MORADO', 'NARANJA FUERTE', 'NARANJA PASTEL', 'NEGRO', 'NUDE', 'OCRE', 'ORO ROSA MATE',
  'OSTRA', 'PELTRE', 'PERGAMINO', 'PLATA MATE', 'PLATA MEDIO', 'PLATINO', 'ROJO CEREZA',
  'ROJO VIVO', 'ROSA PASTEL', 'SALMON PASTEL', 'TABACO', 'TALCO PASTEL', 'TAUPE',
  'TURQUEZA', 'VAINILLA', 'VERDE ALOE', 'VERDE HOJA', 'VERDE NACIONAL', 'VERDE OSCURO',
  'VERDE PASTEL', 'VERDE PINO', 'ROJO CAMPRO', 'MIEL MOUSE'
];

const PLACAS = [
  { key: 'can', label: 'CAN' },
  { key: 'point', label: 'POINT' },
  { key: 'eti', label: 'ETI' },
  { key: 'ilusion', label: 'ILUSION' },
  { key: 'talype', label: 'TALYPE' },
  { key: 'cobra', label: 'COBRA' },
  { key: 'damasco', label: 'DAMASCO' },
  { key: 'boa', label: 'BOA' },
  { key: 'babilla', label: 'BABILLA' },
  { key: 'piedra', label: 'PIEDRA' },
  { key: 'puntos', label: 'PUNTOS' },
  { key: 'mandala', label: 'MANDALA' },
  { key: 'opaco', label: 'OPACO' },
  { key: 'napa_mate', label: 'NAPA MATE' },
  { key: 'envejecido', label: 'ENVEJECIDO' }
];

export default function PedidoNuevo() {
  const [coloresCustom, setColoresCustom] = useState([]);
  const [placasCustom, setPlacasCustom] = useState([]);
  const [nuevoColor, setNuevoColor] = useState('');
  const [nuevaPlaca, setNuevaPlaca] = useState('');
  const [currentPedido, setCurrentPedido] = useState(null);
  const [coloresCatalogo, setColoresCatalogo] = useState([]);

  useEffect(() => {
    initNewPedido();
    loadColoresCatalogo();
  }, []);

  const loadColoresCatalogo = async () => {
    try {
      const colores = await ColorPintura.filter({ estado: 'activo' });
      setColoresCatalogo(colores);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const initNewPedido = async () => {
    const pedidos = await PedidoMarroquinero.list();
    const year = new Date().getFullYear();
    const pedidosDelAnio = pedidos.filter(p => p.numero_pedido?.startsWith(String(year)));
    const nextNum = pedidosDelAnio.length + 1;
    
    setCurrentPedido({
      numero_pedido: `${year}-${String(nextNum).padStart(4, '0')}`,
      pedido_consolidado: '',
      fecha_solicitud: new Date().toISOString().split('T')[0],
      nombre_marroquinero: '',
      cliente_id: '',
      estado: 'pendiente',
      observaciones: '',
      items: [],
      total_hojas: 0
    });
  };

  const agregarColor = () => {
    const newItem = {};
    PLACAS.forEach(placa => { newItem[placa.key] = 0; });
    placasCustom.forEach(placa => { newItem[placa.key] = 0; });
    newItem.codigo_color = '';
    newItem.color = '';
    newItem.total = 0;
    
    setCurrentPedido({
      ...currentPedido,
      items: [...currentPedido.items, newItem]
    });
  };

  const actualizarItem = (index, field, value) => {
    const items = [...currentPedido.items];
    
    // Si cambia el color desde el catálogo, auto-completar código
    if (field === 'color') {
      const colorData = coloresCatalogo.find(c => c.nombre_color === value);
      items[index].color = value;
      items[index].codigo_color = colorData ? colorData.codigo_color : '';
    } else if (field === 'codigo_color') {
      const colorData = coloresCatalogo.find(c => c.codigo_color === value);
      items[index].codigo_color = value;
      items[index].color = colorData ? colorData.nombre_color : '';
    } else {
      items[index][field] = parseFloat(value) || 0;
    }
    
    if (field !== 'color' && field !== 'codigo_color') {
      const allPlacas = [...PLACAS, ...placasCustom];
      items[index].total = allPlacas.reduce((sum, placa) => sum + (items[index][placa.key] || 0), 0);
    }
    
    const totalGeneral = items.reduce((sum, item) => sum + (item.total || 0), 0);
    setCurrentPedido({ ...currentPedido, items, total_hojas: totalGeneral });
  };

  const eliminarItem = (index) => {
    const items = currentPedido.items.filter((_, i) => i !== index);
    const totalGeneral = items.reduce((sum, item) => sum + (item.total || 0), 0);
    setCurrentPedido({ ...currentPedido, items, total_hojas: totalGeneral });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await PedidoMarroquinero.create(currentPedido);
      alert('Pedido guardado exitosamente');
      initNewPedido();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al guardar el pedido');
    }
  };

  const agregarColorPersonalizado = () => {
    if (nuevoColor.trim()) {
      setColoresCustom([...coloresCustom, nuevoColor.trim().toUpperCase()]);
      setNuevoColor('');
    }
  };

  const agregarPlacaPersonalizada = () => {
    if (nuevaPlaca.trim()) {
      const key = nuevaPlaca.trim().toLowerCase().replace(/\s+/g, '_');
      setPlacasCustom([...placasCustom, { key, label: nuevaPlaca.trim().toUpperCase() }]);
      setNuevaPlaca('');
    }
  };

  const todosLosColores = [...COLORES_PREDEFINIDOS, ...coloresCustom];
  const todasLasPlacas = [...PLACAS, ...placasCustom];

  if (!currentPedido) return <div className="p-6">Cargando...</div>;

  return (
    <div className="p-6">
      <PageHeader
        title="Nuevo Pedido"
        description="Registrar pedido individual de marroquinero"
      />

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Información del Pedido</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              <div><Label>No. ID</Label><Input value={currentPedido.numero_pedido} readOnly className="bg-gray-100" /></div>
              <div><Label>Fecha Solicitud *</Label><Input type="date" value={currentPedido.fecha_solicitud} onChange={e => setCurrentPedido({...currentPedido, fecha_solicitud: e.target.value})} required /></div>
              <div><Label>Marroquinero *</Label><Input value={currentPedido.nombre_marroquinero} onChange={e => setCurrentPedido({...currentPedido, nombre_marroquinero: e.target.value})} required /></div>
              <div><Label>Estado</Label><Input value="PENDIENTE" readOnly className="bg-gray-50" /></div>
            </div>
            <div><Label>Observaciones</Label><Textarea value={currentPedido.observaciones} onChange={e => setCurrentPedido({...currentPedido, observaciones: e.target.value})} /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Detalle del Pedido</CardTitle>
              <Button type="button" onClick={agregarColor} variant="outline" size="sm">
                <Plus className="w-4 h-4 mr-1" /> Agregar Color
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-3 bg-blue-50 rounded">
              <div>
                <Label>Agregar Color Personalizado</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nombre del color" value={nuevoColor} onChange={e => setNuevoColor(e.target.value)} />
                  <Button type="button" onClick={agregarColorPersonalizado} size="sm">+</Button>
                </div>
              </div>
              <div>
                <Label>Agregar Placa Personalizada</Label>
                <div className="flex gap-2">
                  <Input placeholder="Nombre de placa" value={nuevaPlaca} onChange={e => setNuevaPlaca(e.target.value)} />
                  <Button type="button" onClick={agregarPlacaPersonalizada} size="sm">+</Button>
                </div>
              </div>
            </div>

            {currentPedido.items.length > 0 && (
              <div className="overflow-x-auto border rounded">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border p-2 sticky left-0 bg-gray-100 z-10 min-w-[120px]">CÓDIGO COLOR</th>
                      <th className="border p-2 sticky left-[120px] bg-gray-100 z-10 min-w-[150px]">COLOR</th>
                      {todasLasPlacas.map(placa => <th key={placa.key} className="border p-2 min-w-[80px]">{placa.label}</th>)}
                      <th className="border p-2 bg-yellow-100 min-w-[100px]">TOTAL HOJAS</th>
                      <th className="border p-2 min-w-[60px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentPedido.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="border p-1 sticky left-0 bg-white z-10">
                          <Select value={item.codigo_color} onValueChange={v => actualizarItem(idx, 'codigo_color', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Código" /></SelectTrigger>
                            <SelectContent>
                              {coloresCatalogo.map(c => <SelectItem key={c.id} value={c.codigo_color}>{c.codigo_color}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="border p-1 sticky left-[120px] bg-white z-10">
                          <Select value={item.color} onValueChange={v => actualizarItem(idx, 'color', v)}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                            <SelectContent>
                              {coloresCatalogo.map(c => <SelectItem key={c.id} value={c.nombre_color}>{c.nombre_color}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        {todasLasPlacas.map(placa => (
                          <td key={placa.key} className="border p-1">
                            <NumericInput 
                              className="h-8 text-center text-xs w-full min-w-[60px]" 
                              value={item[placa.key] || 0} 
                              onChange={v => actualizarItem(idx, placa.key, v)} 
                            />
                          </td>
                        ))}
                        <td className="border p-1 text-center font-bold bg-yellow-50">{item.total}</td>
                        <td className="border p-1 text-center">
                          <Button type="button" variant="destructive" size="sm" onClick={() => eliminarItem(idx)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-green-100 font-bold">
                      <td className="border p-2 sticky left-0 bg-green-100 z-10" colSpan="2">TOTAL</td>
                      {todasLasPlacas.map(placa => (
                        <td key={placa.key} className="border p-2 text-center">
                          {currentPedido.items.reduce((sum, item) => sum + (item[placa.key] || 0), 0)}
                        </td>
                      ))}
                      <td className="border p-2 text-center bg-yellow-200">{currentPedido.total_hojas}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700">
            <Save className="w-4 h-4 mr-2" />
            Guardar Pedido
          </Button>
        </div>
      </form>
    </div>
  );
}