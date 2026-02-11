import React, { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  ChevronDown,
  ChevronRight,
  Home,
  ShoppingCart,
  Settings,
  Package,
  TrendingUp,
  Calculator,
  Users,
  LogOut,
  Menu,
  X,
  Star
} from "lucide-react";
import { User } from "@/entities/User";
import { Button } from "@/components/ui/button";
import ChatBotFloating from "@/components/agent/ChatBotFloating";

const menuItems = [
  {
    title: "Inicio",
    url: createPageUrl("Dashboard"),
    icon: Home,
    roles: ["admin", "contador", "operario"]
  },
  {
    title: "Compras",
    icon: ShoppingCart,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Compras", url: createPageUrl("CompraInsumos"), icon: ShoppingCart }
    ]
  },
  {
    title: "Producción",
    icon: Settings,
    roles: ["admin", "operario"],
    subItems: [
      { title: "Recepción", url: createPageUrl("ProcesoRecepcion"), icon: Settings },
      { title: "Limpieza", url: createPageUrl("ProcesoLimpieza"), icon: Settings },
      { title: "Curtido", url: createPageUrl("ProcesoCurtido"), icon: Settings },
      { title: "Recurtido", url: createPageUrl("ProcesoRecurtido"), icon: Settings },
      { title: "Acabado", url: createPageUrl("ProcesoAcabado"), icon: Settings },
      { title: "Otros Costos de Producción", url: createPageUrl("ServiciosProduccion"), icon: Settings },
      { title: "Pintura", url: createPageUrl("Pintura"), icon: Settings },
      { title: "Costos Indirectos", url: createPageUrl("CostosIndirectos"), icon: Settings }
    ]
  },
  {
    title: "Procesos",
    icon: Package,
    roles: ["admin", "operario"],
    subItems: [
      { title: "Órdenes de Producción", url: createPageUrl("ProduccionOrdenes"), icon: Package },
      { title: "Planificación", url: createPageUrl("ProduccionPlanificacion"), icon: Package },
      { title: "Consumo de Insumos", url: createPageUrl("ProduccionConsumoInsumos"), icon: Package },
      { title: "Reporte de Etapas", url: createPageUrl("ProduccionReporteEtapas"), icon: Package }
    ]
  },
  {
    title: "Ventas",
    icon: TrendingUp,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Venta de Productos", url: createPageUrl("VentaProductos"), icon: TrendingUp },
      { title: "Venta de Servicios", url: createPageUrl("VentaServicios"), icon: TrendingUp }
    ]
  },
  {
    title: "Gestión de Pedidos",
    icon: Package,
    roles: ["admin", "contador", "operario"],
    subItems: [
      { title: "Nuevo Pedido", url: createPageUrl("PedidoNuevo"), icon: Package },
      { title: "Pedidos Individuales", url: createPageUrl("PedidosIndividuales"), icon: Package },
      { title: "Consolidar Pedidos", url: createPageUrl("ConsolidarPedidos"), icon: Package },
      { title: "Consolidados Generales", url: createPageUrl("ConsolidadosGenerales"), icon: Package }
    ]
  },
  {
    title: "Finanzas/Tesorería",
    icon: Users,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Recibo de Caja", url: createPageUrl("ReciboCaja"), icon: Calculator },
      { title: "Comprobante de Egreso", url: createPageUrl("ComprobanteEgreso"), icon: Calculator },
      { title: "Cuentas por Pagar", url: createPageUrl("CuentasPorPagar"), icon: Calculator },
      { title: "Cuentas por Cobrar", url: createPageUrl("CuentasPorCobrar"), icon: Calculator }
    ]
  },
  {
    title: "Gestión de Bancos",
    icon: Calculator,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Cuentas Bancarias", url: createPageUrl("CuentasBancarias"), icon: Calculator },
      { title: "Movimientos Bancarios", url: createPageUrl("MovimientosBancarios"), icon: Calculator },
      { title: "Transferencias Internas", url: createPageUrl("TransferenciasBancarias"), icon: Calculator },
      { title: "Conciliación Bancaria", url: createPageUrl("ConciliacionBancaria"), icon: Calculator }
    ]
  },
  {
    title: "Gestión de Caja",
    icon: Calculator,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Movimientos de Caja", url: createPageUrl("CajaMovimientos"), icon: Calculator },
      { title: "Transferencias entre Cajas", url: createPageUrl("CajaTransferencias"), icon: Calculator },
      { title: "Configuración Cajas", url: createPageUrl("CajaConfig"), icon: Calculator }
    ]
  },
  {
    title: "Inventarios",
      icon: Package,
      roles: ["admin", "operario"],
      subItems: [
        { title: "Catálogo de Productos", url: createPageUrl("CatalogoProductos"), icon: Package },
        { title: "Catálogo de Colores (Pintura)", url: createPageUrl("CatalogoColores"), icon: Package },
        { title: "Inventario de Materias Primas", url: createPageUrl("InventarioProduccion"), icon: Package },
        { title: "Inventario de Insumos y Químicos", url: createPageUrl("InventarioInsumos"), icon: Package },
        { title: "Inventarios en Proceso", url: createPageUrl("InventarioEnProceso"), icon: Package },
        { title: "Inventario de Productos Terminados", url: createPageUrl("InventarioProductos"), icon: Package },
        { title: "Ajuste de Inventario", url: createPageUrl("AjusteInventario"), icon: Package },
        { title: "Traslado de Inventarios", url: createPageUrl("TrasladoInventario"), icon: Package }
      ]
  },
  {
    title: "Contabilidad",
    icon: Calculator,
    roles: ["admin", "contador"],
    subItems: [
      { title: "Libro Diario", url: createPageUrl("LibroDiario"), icon: Calculator },
      { title: "Plan de Cuentas", url: createPageUrl("PlanCuentas"), icon: Calculator },
      { title: "Libro Mayor/Balances", url: createPageUrl("LibroMayor"), icon: Calculator },
      { title: "Gastos", url: createPageUrl("ContabilidadGastos"), icon: Calculator },
      { title: "Otros Ingresos", url: createPageUrl("ContabilidadIngresos"), icon: Calculator },
      { title: "Traslados Efectivo", url: createPageUrl("ContabilidadTraslados"), icon: Calculator },
      { title: "Cuentas por Pagar", url: createPageUrl("ContabilidadPagar"), icon: Calculator },
      { title: "Cuentas por Cobrar", url: createPageUrl("ContabilidadCobrar"), icon: Calculator },
      { title: "Informe de Caja", url: createPageUrl("InformeCaja"), icon: Calculator },
      { title: "Informe de Costos", url: createPageUrl("InformeCostos"), icon: Calculator }
    ]
  },
  {
    title: "Reportes",
    icon: TrendingUp,
    roles: ["admin", "contador", "operario"],
    subItems: [
      { title: "Reportes de Ventas", url: createPageUrl("ReportesVentas"), icon: TrendingUp },
      { title: "Reportes de Compras", url: createPageUrl("ReportesCompras"), icon: TrendingUp },
      { title: "Reportes de Inventario", url: createPageUrl("ReportesInventario"), icon: TrendingUp },
      { title: "Reportes de Producción", url: createPageUrl("ReportesProduccion"), icon: TrendingUp },
      { title: "Reportes Financieros", url: createPageUrl("ReportesFinancieros"), icon: TrendingUp },
      { title: "Reportes de Procesos", url: createPageUrl("ReportesProcesos"), icon: TrendingUp },
      { title: "Reportes Bancarios", url: createPageUrl("ReportesBancarios"), icon: TrendingUp },
      { title: "Reportes de Movimientos de Caja", url: createPageUrl("ReportesMovimientosCaja"), icon: TrendingUp }
    ]
  },
  {
    title: "Administración",
    icon: Users,
    roles: ["admin"],
    subItems: [
      { title: "Terceros", url: createPageUrl("AdminTerceros"), icon: Users },
      { title: "Actividades", url: createPageUrl("AdminActividades"), icon: Users },
      { title: "Servicios", url: createPageUrl("AdminServicios"), icon: Users },
      { title: "Unidades de Medida", url: createPageUrl("AdminUnidadesMedida"), icon: Users },
      { title: "Tipos de Gasto", url: createPageUrl("AdminTiposGasto"), icon: Calculator }
    ]
  },
  {
    title: "Recursos Humanos",
    icon: Users,
    roles: ["admin"],
    subItems: [
        { title: "Personal", url: createPageUrl("RHEmpleados"), icon: Users },
        { title: "Liquidación de Mano de Obra", url: createPageUrl("RHNomina"), icon: Calculator },
        { title: "Registro de Producción", url: createPageUrl("RHAsistencia"), icon: Users }
    ]
  },
  {
    title: "Usuario",
    icon: Users,
    roles: ["admin"],
    subItems: [
        { title: "Usuarios del Sistema", url: createPageUrl("UsuariosSistema"), icon: Users },
        { title: "Roles y Permisos", url: createPageUrl("RolesPermisos"), icon: Settings }
    ]
  }
];

const MenuItem = ({ item, expandedMenus, toggleMenu, isActiveLink, togglePin, pinnedShortcuts, setSidebarOpen, userHasRole, isCollapsed }) => {
    const isVisible = item.roles ? userHasRole(item.roles) : true;
    if (!isVisible) return null;

    if (item.subItems) {
        return (
            <li>
                <button
                    onClick={() => toggleMenu(item.title)}
                    className="w-full flex items-center justify-between p-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-all duration-200 group"
                    title={isCollapsed ? item.title : ''}
                >
                    <div className="flex items-center space-x-3">
                        <item.icon className="w-5 h-5 group-hover:text-emerald-600 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium">{item.title}</span>}
                    </div>
                    {!isCollapsed && (expandedMenus[item.title] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
                </button>
                {expandedMenus[item.title] && !isCollapsed && (
                    <ul className="mt-2 ml-4 space-y-1">
                        {item.subItems.map((subItem) => {
                            const isSubVisible = subItem.roles ? userHasRole(subItem.roles) : true;
                            if (!isSubVisible) return null;
                            const isPinned = pinnedShortcuts.some(s => s.url === subItem.url);
                            return (
                                <li key={subItem.title} className="flex items-center group">
                                    <Link
                                        to={subItem.url}
                                        className={`flex-grow block p-2 pl-4 text-sm rounded-md transition-all duration-200 ${isActiveLink(subItem.url) ? 'bg-emerald-100 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-gray-100 hover:text-slate-800'}`}
                                        onClick={() => setSidebarOpen(false)}
                                    >
                                        {subItem.title}
                                    </Link>
                                    <button 
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            togglePin(subItem.url, subItem.title, subItem.icon?.name || 'Settings');
                                        }} 
                                        className="p-2 text-slate-400 hover:text-yellow-500 transition-colors group-hover:opacity-100 opacity-60"
                                        title={isPinned ? "Quitar de accesos directos" : "Fijar en accesos directos"}
                                    >
                                        <Star className={`w-4 h-4 ${isPinned ? 'fill-yellow-400 text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </li>
        );
    }
    
    // Para ítems de menú que no tienen subítems (como "Inicio")
    const isPinned = pinnedShortcuts.some(s => s.url === item.url);
    return (
        <li className="flex items-center group">
            <Link
                to={item.url}
                className={`flex-grow flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 ${isActiveLink(item.url) ? 'bg-emerald-100 text-emerald-700' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
                onClick={() => setSidebarOpen(false)}
                title={isCollapsed ? item.title : ''}
            >
                <item.icon className="w-5 h-5 group-hover:text-emerald-600 flex-shrink-0" />
                {!isCollapsed && <span className="font-medium">{item.title}</span>}
            </Link>
            {!isCollapsed && (
                <button 
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePin(item.url, item.title, item.icon?.name || 'Home');
                    }} 
                    className="p-2 text-slate-400 hover:text-yellow-500 transition-colors group-hover:opacity-100 opacity-60"
                    title={isPinned ? "Quitar de accesos directos" : "Fijar en accesos directos"}
                >
                    <Star className={`w-4 h-4 ${isPinned ? 'fill-yellow-400 text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`} />
                </button>
            )}
        </li>
    );
};

export default function Layout({ children, currentPageName }) {
    const location = useLocation();
    const [expandedMenus, setExpandedMenus] = useState({});
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [pinnedShortcuts, setPinnedShortcuts] = useState([]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const user = await User.me();
                setCurrentUser(user);
                setPinnedShortcuts(Array.isArray(user.pinned_shortcuts) ? user.pinned_shortcuts : []);
            } catch (e) {
                setCurrentUser(null);
            }
        };
        fetchUser();
    }, []);

    const togglePin = useCallback(async (itemUrl, itemTitle, itemIcon) => {
        const isPinned = pinnedShortcuts.some(s => s.url === itemUrl);
        let newPinned;
        
        if (isPinned) {
            newPinned = pinnedShortcuts.filter(s => s.url !== itemUrl);
        } else {
            newPinned = [...pinnedShortcuts, { 
                url: itemUrl, 
                title: itemTitle,
                icon: itemIcon
            }];
        }
        
        setPinnedShortcuts(newPinned);
        
        if (currentUser) {
            try {
                await User.updateMyUserData({ pinned_shortcuts: newPinned });
            } catch (error) {
                console.error("Error updating pinned shortcuts:", error);
            }
        }
    }, [pinnedShortcuts, currentUser]);

    const toggleMenu = (title) => {
        setExpandedMenus(prev => ({ ...prev, [title]: !prev[title] }));
    };

    const handleLogout = async () => {
        await User.logout();
    };

    const isActiveLink = useCallback((url) => location.pathname === url, [location.pathname]);

    const userHasRole = useCallback((roles) => {
        if (!currentUser || !currentUser.role) return false;
        return roles.includes(currentUser.role);
    }, [currentUser]);

    const getPageTitle = (name) => {
        // Mapeo de nombres de página a títulos en español
        const titles = {
            'Dashboard': 'Panel Principal',
            'CompraInsumos': 'Compra de Insumos',
            'CompraPieles': 'Compra de Pieles',
            'CompraHojas': 'Compra de Hojas',
            'OtrasCompras': 'Otras Compras', 
            'ProcesoRecepcion': 'Recepción de Materia Prima',
            'ProcesoLimpieza': 'Proceso de Limpieza',
            'ProcesoCurtido': 'Proceso de Curtido',
            'ProcesoAcabado': 'Proceso de Acabado',
            'ProcesoRecurtido': 'Proceso de Recurtido',
            'ProduccionOrdenes': 'Órdenes de Producción',
            'ProduccionPlanificacion': 'Planificación de Producción',
            'ProduccionConsumoInsumos': 'Consumo de Insumos',
            'ProduccionReporteEtapas': 'Reporte de Etapas',
            'VentaProductos': 'Venta de Productos',
            'VentaServicios': 'Venta de Servicios',
            'GestionPedidos': 'Gestión de Pedidos',
            'ReciboCaja': 'Recibo de Caja',
            'ComprobanteEgreso': 'Comprobante de Egreso',
            'InventarioProduccion': 'Inventario de Materias Primas',
            'InventarioInsumos': 'Inventario de Insumos y Químicos',
            'InventarioEnProceso': 'Inventarios en Proceso',
            'InventarioProductos': 'Inventario de Productos Terminados',
            'ContabilidadGastos': 'Registro de Gastos',
            'ContabilidadIngresos': 'Otros Ingresos',
            'ContabilidadTraslados': 'Traslados de Efectivo',
            'ContabilidadPagar': 'Cuentas por Pagar',
            'ContabilidadCobrar': 'Cuentas por Cobrar',
            'CatalogoProductos': 'Catálogo de Productos',
            'AjusteInventario': 'Ajuste de Inventario',
            'InformeCaja': 'Informe de Caja',
            'InformeCostos': 'Informe de Costos',
            'CajaBancos': 'Caja y Bancos',
            'CuentasBancarias': 'Cuentas Bancarias',
            'BilleterasDigitales': 'Nequi/Billeteras Digitales',
            'IngresosBancarios': 'Ingresos por Transferencias',
            'EgresosBancarios': 'Egresos Bancarios',
            'ConciliacionBancaria': 'Conciliación Bancaria',
            'ReporteCuentas': 'Reporte por Cuenta',
            'PlanCuentas': 'Plan de Cuentas',
            'LibroMayor': 'Libro Mayor/Balances',
            'LibroDiario': 'Libro Diario',
            'AdminTerceros': 'Administración de Terceros',
            'AdminActividades': 'Gestión de Actividades',
            'AdminServicios': 'Gestión de Servicios',
            'AdminUnidadesMedida': 'Unidades de Medida',
            'AdminTiposGasto': 'Tipos de Gasto',
            'TrasladoInventario': 'Traslado de Inventarios',
            'ReportesVentas': 'Reportes de Ventas',
            'ReportesCompras': 'Reportes de Compras',
            'ReportesInventario': 'Reportes de Inventario',
            'ReportesProduccion': 'Reportes de Producción',
            'ReportesFinancieros': 'Reportes Financieros',
            'ReportesProcesos': 'Reportes de Procesos',
            'CostosIndirectos': 'Costos Indirectos',
            'CostosServicioMaquinaria': 'Servicios de Maquinaria',
            'CostosServicioManoObra': 'Servicio de Mano de Obra',
            'CostosOtrosCostos': 'Otros Costos',
            'Pintura': 'Pintura',
            'RHEmpleados': 'Gestión de Empleados',
            'RHNomina': 'Gestión de Nómina',
            'RHAsistencia': 'Control de Asistencia',
            'UsuariosSistema': 'Usuarios del Sistema',
            'RolesPermisos': 'Roles y Permisos'
        };
        return titles[name] || name || 'Inicio';
    };

    // Determinar si el sidebar debe estar colapsado
    const isCollapsed = !isHovering && !sidebarOpen;
    const sidebarWidth = isCollapsed ? 'w-16' : 'w-80';

    return (
        <div className="min-h-screen bg-gray-50 flex">
            <style>
            {`
              :root {
                --primary-dark: #2c3e50;
                --accent-green: #1abc9c;
                --white: #ffffff;
                --gray-light: #ecf0f1;
                --gray-medium: #bdc3c7;
              }
              
              @media print {
                body * {
                  visibility: hidden;
                }
                #tabla-imprimible, #tabla-imprimible * {
                  visibility: visible;
                }
                #tabla-imprimible {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
                #page-header {
                  display: none;
                }
              }
            `}
            </style>
            
            {sidebarOpen && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside 
                className={`
                    fixed lg:relative inset-y-0 left-0 z-50 ${sidebarWidth} bg-white shadow-xl transform transition-all duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                    flex flex-col
                `}
                onMouseEnter={() => setIsHovering(true)}
                onMouseLeave={() => {
                    setIsHovering(false);
                    setExpandedMenus({}); // Contrae todos los submenús al salir
                }}
            >
                <div className="h-20 bg-gradient-to-r from-stone-100 to-stone-200 border-b border-stone-300 flex items-center justify-between px-4">
                    <div className="flex items-center space-x-3">
                        <img 
                            src="https://www.artecueros.com/wp-content/uploads/2025/05/logogrande.png"
                            alt="ArteCueros Logo"
                            className="h-10 w-10 object-contain flex-shrink-0"
                            onError={(e) => { 
                                e.target.onerror = null; 
                                e.target.src='https://cdn-icons-png.flaticon.com/512/1973/1973885.png'; 
                                e.target.style.backgroundColor='white'; 
                                e.target.style.padding='2px'; 
                                e.target.style.borderRadius='8px';
                            }}
                        />
                        {!isCollapsed && (
                            <div className="transition-opacity duration-300">
                                <h1 className="text-stone-800 font-bold text-lg">ArteCueros</h1>
                                <p className="text-stone-600 text-xs">Mejía</p>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="lg:hidden text-stone-600 hover:bg-stone-200"
                        onClick={() => setSidebarOpen(false)}
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <nav className="flex-1 overflow-y-auto p-2">
                    <ul className="space-y-1">
                        {menuItems.map((item) => (
                           <MenuItem
                             key={item.title}
                             item={item}
                             expandedMenus={expandedMenus}
                             toggleMenu={toggleMenu}
                             isActiveLink={isActiveLink}
                             togglePin={togglePin}
                             pinnedShortcuts={pinnedShortcuts}
                             setSidebarOpen={setSidebarOpen}
                             userHasRole={userHasRole}
                             isCollapsed={isCollapsed}
                           />
                        ))}
                    </ul>
                </nav>

                <div className="p-2 mt-auto border-t border-gray-200">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group"
                        title={isCollapsed ? "Salir" : ''}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        {!isCollapsed && <span className="font-medium">Salir</span>}
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0">
                <header className="h-20 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6">
                    <div className="flex items-center space-x-4">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="lg:hidden"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu className="w-6 h-6" />
                        </Button>
                        <div>
                            <h2 className="text-xl font-semibold text-slate-800">
                                {getPageTitle(currentPageName)}
                            </h2>
                            <p className="text-sm text-slate-500">Sistema de Gestión - ArteCueros Mejía</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-auto">
                    {children}
                </div>
                </main>

                {/* Copiloto ERP - Chat Flotante Global */}
                <ChatBotFloating agentName="copiloto_erp" />
                </div>
                );
                }