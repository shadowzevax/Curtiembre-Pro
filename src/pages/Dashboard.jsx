import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  ShoppingCart, Settings, TrendingUp, Package, Calculator, Users,
  ArrowRight, Activity, DollarSign, AlertTriangle, Home, Star
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrdenCompra } from "@/entities/OrdenCompra";
import { OrdenVenta } from "@/entities/OrdenVenta";
import { Insumo } from "@/entities/Insumo";
import { ProcesoProduccion } from "@/entities/ProcesoProduccion";
import { User } from "@/entities/User";
import StockAlerts from "../components/dashboard/StockAlerts";

// Mapeo de iconos por nombre
const iconMap = {
  'ShoppingCart': ShoppingCart,
  'Settings': Settings,
  'TrendingUp': TrendingUp,
  'Package': Package,
  'Calculator': Calculator,
  'Users': Users,
  'Home': Home
};

export default function Dashboard() {
  const [stats, setStats] = useState({
    compras: 0,
    ventas: 0,
    procesosPendientes: 0,
    insumosbajoStock: 0,
    comprasMes: 0,
    ventasMes: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [pinnedShortcuts, setPinnedShortcuts] = useState([]);

  useEffect(() => {
    loadDashboardData();
    loadUserShortcuts();
  }, []);

  const loadUserShortcuts = async () => {
    try {
      const user = await User.me();
      setCurrentUser(user);
      setPinnedShortcuts(Array.isArray(user.pinned_shortcuts) ? user.pinned_shortcuts : []);
    } catch (error) {
      console.error("Error loading user shortcuts:", error);
    }
  };

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      const [compras, ventas, procesos, insumos] = await Promise.all([
        OrdenCompra.list('-created_date', 100).catch(() => []),
        OrdenVenta.list('-created_date', 100).catch(() => []),
        ProcesoProduccion.filter({ estado: "pendiente" }).catch(() => []),
        Insumo.list().catch(() => [])
      ]);

      const insumosbajoStock = insumos.filter(insumo => 
        insumo.stock_actual <= insumo.stock_minimo
      ).length;

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const comprasMes = compras.filter(c => new Date(c.fecha_orden) >= firstDayOfMonth)
                                .reduce((sum, c) => sum + (c.total || 0), 0);
      const ventasMes = ventas.filter(v => new Date(v.fecha_orden) >= firstDayOfMonth)
                               .reduce((sum, v) => sum + (v.total || 0), 0);
      
      const recentCompras = compras.slice(0, 2).map(c => ({...c, type: 'compra'}));
      const recentVentas = ventas.slice(0, 2).map(v => ({...v, type: 'venta'}));
      const activity = [...recentCompras, ...recentVentas].sort((a,b) => new Date(b.created_date) - new Date(a.created_date));
      setRecentActivity(activity);

      setStats({
        compras: compras.length,
        ventas: ventas.length,
        procesosPendientes: procesos.length,
        insumosbajoStock,
        comprasMes,
        ventasMes
      });
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount);

  return (
    <div className="p-6 space-y-8">
      {/* Welcome Header */}
      <div className="text-center py-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          Bienvenido a ArteCueros Mejía
        </h1>
        <p className="text-slate-600 text-lg">
          Sistema de gestión integral para tu curtiembre
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Órdenes de Compra
            </CardTitle>
            <ShoppingCart className="h-5 w-5 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{isLoading ? '...' : stats.compras}</div>
            <p className="text-xs text-slate-500">Total histórico</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Órdenes de Venta
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{isLoading ? '...' : stats.ventas}</div>
            <p className="text-xs text-slate-500">Total histórico</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Procesos Pendientes
            </CardTitle>
            <Activity className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{isLoading ? '...' : stats.procesosPendientes}</div>
            {stats.procesosPendientes > 0 ? (
                <p className="text-xs text-red-500">Requieren atención</p>
              ) : (
                <p className="text-xs text-green-600">Todo al día</p>
            )}
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-shadow duration-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">
              Insumos Bajo Stock
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-slate-800">{isLoading ? '...' : stats.insumosbajoStock}</div>
            {stats.insumosbajoStock > 0 ? (
                <p className="text-xs text-red-500">Necesitan reabastecimiento</p>
              ) : (
                <p className="text-xs text-green-600">Stock suficiente</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accesos Directos Personalizados */}
      {pinnedShortcuts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-6">
            <Star className="w-6 h-6 text-yellow-500" />
            <h2 className="text-2xl font-bold text-slate-800">Mis Accesos Directos</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pinnedShortcuts.map((shortcut) => {
              const IconComponent = iconMap[shortcut.icon] || Settings;
              return (
                <Link
                  key={shortcut.url}
                  to={shortcut.url}
                  className="group block"
                >
                  <Card className="hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="p-4 flex items-center space-x-3">
                      <div className="bg-emerald-500 p-3 rounded-xl shadow-lg">
                        <IconComponent className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 text-sm truncate">
                          {shortcut.title}
                        </h3>
                        <p className="text-xs text-slate-500">Acceso directo</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-emerald-500 transition-colors duration-200" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Stock Alerts */}
      <StockAlerts />

      {/* Recent Activity & Financial Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5 text-emerald-500" />
              <span>Actividad Reciente</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? <p>Cargando actividad...</p> : recentActivity.length > 0 ? recentActivity.map(item => (
                <div key={item.id} className="flex items-start space-x-3">
                  <div className={`mt-1 p-1 rounded-full ${item.type === 'compra' ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                    {item.type === 'compra' ? 
                      <ShoppingCart className="h-4 w-4 text-blue-500" /> : 
                      <TrendingUp className="h-4 w-4 text-emerald-500" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-800">
                      {item.type === 'compra' ? 'Nueva compra' : 'Nueva venta'} #{item.numero_orden}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatCurrency(item.total)} - {new Date(item.created_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )) : (
                <div className="text-center py-8 text-slate-500">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No hay actividad reciente</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-emerald-500" />
              <span>Resumen Financiero (Mes Actual)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Compras del mes</span>
                <span className="font-semibold text-red-600">{isLoading ? '...' : formatCurrency(stats.comprasMes)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Ventas del mes</span>
                <span className="font-semibold text-emerald-600">{isLoading ? '...' : formatCurrency(stats.ventasMes)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm font-medium text-slate-600">Balance</span>
                <span className={`font-bold text-xl ${stats.ventasMes - stats.comprasMes >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {isLoading ? '...' : formatCurrency(stats.ventasMes - stats.comprasMes)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}