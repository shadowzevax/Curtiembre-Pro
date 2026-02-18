import React, { useState, useEffect } from 'react';
import { ProcesoProduccion, InventarioEnProceso } from '@/entities/all';
import PageHeader from '../components/common/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, CheckCircle2, Clock, XCircle } from 'lucide-react';

const formatDate = (dateString) => dateString ? new Date(dateString).toLocaleDateString('es-CO') : 'N/A';

export default function LoteDetalladoConsolidado() {
  const [busquedaLote, setBusquedaLote] = useState('');
  const [loteOriginal, setLoteOriginal] = useState(null);
  const [sublotes, setSublotes] = useState([]);
  const [procesos, setProcesos] = useState([]);
  const [inventarios, setInventarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const buscarLote = async () => {
    if (!busquedaLote.trim()) {
      alert('Por favor ingrese un código de lote para buscar');
      return;
    }

    setLoading(true);
    try {
      // Buscar el lote original en procesos de recepción
      const recepcionOriginal = await ProcesoProduccion.filter({
        tipo_proceso: 'recepcion',
        codigo_lote: busquedaLote.trim()
      });

      if (!recepcionOriginal || recepcionOriginal.length === 0) {
        alert('No se encontró el lote especificado');
        setLoteOriginal(null);
        setSublotes([]);
        setLoading(false);
        return;
      }

      setLoteOriginal(recepcionOriginal[0]);

      // Obtener todos los sublotes generados
      const sublotesData = recepcionOriginal[0].sublotes || [];
      
      // Cargar datos de inventario y procesos para cada sublote
      const sublotesConDatos = await Promise.all(
        sublotesData.map(async (sublote) => {
          // Inventario actual del sublote
          const inventario = await InventarioEnProceso.filter({ codigo_lote: sublote.codigo });
          
          // Procesos registrados para este sublote
          const procesosLimpieza = await ProcesoProduccion.filter({ 
            tipo_proceso: 'limpieza',
            codigo_lote: sublote.codigo 
          });
          const procesosCurtido = await ProcesoProduccion.filter({ 
            tipo_proceso: 'curtido',
            codigo_lote: sublote.codigo 
          });
          const procesosRecurtido = await ProcesoProduccion.filter({ 
            tipo_proceso: 'recurtido',
            codigo_lote: sublote.codigo 
          });
          const procesosAcabado = await ProcesoProduccion.filter({ 
            tipo_proceso: 'acabado',
            codigo_lote: sublote.codigo 
          });

          return {
            ...sublote,
            inventario: inventario[0] || null,
            limpieza: procesosLimpieza[0] || null,
            curtido: procesosCurtido[0] || null,
            recurtido: procesosRecurtido[0] || null,
            acabado: procesosAcabado[0] || null
          };
        })
      );

      setSublotes(sublotesConDatos);
    } catch (error) {
      console.error('Error:', error);
      alert('Error al buscar el lote');
    } finally {
      setLoading(false);
    }
  };

  const getEtapaActual = (sublote) => {
    if (!sublote.inventario) return 'Sin registro en inventario';
    return sublote.inventario.etapa_actual || 'No definida';
  };

  const getEstadoEtapa = (proceso) => {
    if (!proceso) return { icon: Clock, color: 'bg-gray-200 text-gray-700', texto: 'Pendiente' };
    if (proceso.estado === 'finalizado') return { icon: CheckCircle2, color: 'bg-green-100 text-green-700', texto: 'Finalizado' };
    if (proceso.estado === 'en_proceso') return { icon: Clock, color: 'bg-blue-100 text-blue-700', texto: 'En Proceso' };
    return { icon: XCircle, color: 'bg-red-100 text-red-700', texto: 'Pausado' };
  };

  return (
    <div className="p-6">
      <PageHeader
        title="Lote Detallado Consolidado"
        description="Reporte de trazabilidad completa de lotes y sub-lotes en producción"
      />

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Búsqueda de Lote</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label>Código de Lote Original</Label>
              <Input
                placeholder="Ej: LT2026-001"
                value={busquedaLote}
                onChange={e => setBusquedaLote(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && buscarLote()}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={buscarLote} disabled={loading}>
                <Search className="w-4 h-4 mr-2" />
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loteOriginal && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Información del Lote Original</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-semibold">Código:</span>
                <p className="font-mono text-lg">{loteOriginal.codigo_lote}</p>
              </div>
              <div>
                <span className="font-semibold">Fecha Recepción:</span>
                <p>{formatDate(loteOriginal.fecha_inicio)}</p>
              </div>
              <div>
                <span className="font-semibold">Proveedor:</span>
                <p>{loteOriginal.nombre_proveedor || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold">Producto:</span>
                <p>{loteOriginal.descripcion_producto || 'N/A'}</p>
              </div>
              <div>
                <span className="font-semibold">Total Hojas:</span>
                <p className="font-bold text-blue-600">{loteOriginal.cantidad_total_lote_hojas || 0}</p>
              </div>
              <div>
                <span className="font-semibold">Total Pieles:</span>
                <p className="font-bold text-blue-600">{loteOriginal.cantidad_total_lote_pieles || 0}</p>
              </div>
              <div>
                <span className="font-semibold">Sublotes Generados:</span>
                <p className="font-bold text-purple-600">{sublotes.length}</p>
              </div>
              <div>
                <span className="font-semibold">Estado:</span>
                <Badge variant={loteOriginal.estado === 'finalizado' ? 'default' : 'secondary'}>
                  {loteOriginal.estado?.toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sublotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Detalle de Sub-lotes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {sublotes.map((sublote, idx) => {
                const estadoLimpieza = getEstadoEtapa(sublote.limpieza);
                const estadoCurtido = getEstadoEtapa(sublote.curtido);
                const estadoRecurtido = getEstadoEtapa(sublote.recurtido);
                const estadoAcabado = getEstadoEtapa(sublote.acabado);

                return (
                  <div key={idx} className="border rounded-lg p-4 bg-slate-50">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-bold font-mono text-blue-700">{sublote.codigo}</h3>
                        <p className="text-sm text-slate-600">
                          Cantidad actual: <span className="font-bold">{sublote.inventario?.cantidad_hojas || sublote.cantidad || 0} hojas</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-slate-500">Etapa Actual</p>
                        <Badge variant="outline" className="text-sm">
                          {getEtapaActual(sublote)}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Limpieza */}
                      <div className={`p-3 rounded-lg ${estadoLimpieza.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <estadoLimpieza.icon className="w-5 h-5" />
                          <span className="font-semibold">Limpieza</span>
                        </div>
                        <p className="text-xs">{estadoLimpieza.texto}</p>
                        {sublote.limpieza?.fecha_fin && (
                          <p className="text-xs mt-1">Finalizado: {formatDate(sublote.limpieza.fecha_fin)}</p>
                        )}
                      </div>

                      {/* Curtido */}
                      <div className={`p-3 rounded-lg ${estadoCurtido.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <estadoCurtido.icon className="w-5 h-5" />
                          <span className="font-semibold">Curtido</span>
                        </div>
                        <p className="text-xs">{estadoCurtido.texto}</p>
                        {sublote.curtido?.fecha_fin && (
                          <p className="text-xs mt-1">Finalizado: {formatDate(sublote.curtido.fecha_fin)}</p>
                        )}
                      </div>

                      {/* Recurtido */}
                      <div className={`p-3 rounded-lg ${estadoRecurtido.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <estadoRecurtido.icon className="w-5 h-5" />
                          <span className="font-semibold">Recurtido</span>
                        </div>
                        <p className="text-xs">{estadoRecurtido.texto}</p>
                        {sublote.recurtido?.fecha_fin && (
                          <p className="text-xs mt-1">Finalizado: {formatDate(sublote.recurtido.fecha_fin)}</p>
                        )}
                      </div>

                      {/* Acabado */}
                      <div className={`p-3 rounded-lg ${estadoAcabado.color}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <estadoAcabado.icon className="w-5 h-5" />
                          <span className="font-semibold">Acabado</span>
                        </div>
                        <p className="text-xs">{estadoAcabado.texto}</p>
                        {sublote.acabado?.fecha_fin && (
                          <p className="text-xs mt-1">Finalizado: {formatDate(sublote.acabado.fecha_fin)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!loteOriginal && !loading && (
        <Card>
          <CardContent className="text-center py-12 text-slate-500">
            <Search className="w-16 h-16 mx-auto mb-4 text-slate-300" />
            <p>Ingrese un código de lote para visualizar su trazabilidad completa</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}