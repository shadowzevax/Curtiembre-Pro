import React, { useState, useEffect, useCallback, useRef } from "react";
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
import SidebarSearch from "@/components/layout/SidebarSearch";

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
            { title: "Costos Indirectos", url: createPageUrl("CostosIndirectos"), icon: Settings },
            { title: "Lote Detallado Consolidado", url: createPageUrl("LoteDetalladoConsolidado"), icon: Settings }
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
            { title: "Cuentas por Cobrar", url: createPageUrl("CuentasPorCobrar"), icon: Calculator },
            {
                title: "Gestión de Efectivo", icon: Calculator, subItems: [
                    { title: "Configuración de Cajas", url: createPageUrl("CajaConfig"), icon: Calculator },
                    { title: "Movimientos de Caja", url: createPageUrl("CajaMovimientos"), icon: Calculator },
                    { title: "Transferencias entre Cajas", url: createPageUrl("CajaTransferencias"), icon: Calculator }
                ]
            },
            {
                title: "Gestión Bancaria", icon: Calculator, subItems: [
                    { title: "Cuentas Bancarias", url: createPageUrl("CuentasBancarias"), icon: Calculator },
                    { title: "Movimientos Bancarios", url: createPageUrl("MovimientosBancarios"), icon: Calculator },
                    { title: "Transferencias Internas", url: createPageUrl("TransferenciasBancarias"), icon: Calculator },
                    { title: "Conciliación Bancaria", url: createPageUrl("ConciliacionBancaria"), icon: Calculator }
                ]
            }
        ]
    },
    {
        title: "Inventarios",
        icon: Package,
        roles: ["admin", "operario"],
        subItems: [
            { title: "Ajuste Inicial de Inventario", url: createPageUrl("AjusteInicialInventario"), icon: Package },
            { title: "Catálogo Maestro de Productos", url: createPageUrl("CatalogoProductos"), icon: Package },
            { title: "Catálogo de Colores", url: createPageUrl("CatalogoColores"), icon: Package },
            { title: "Catálogo Tipo de Acabado de Cuero", url: createPageUrl("CatalogoTipoAcabado"), icon: Package },
            { title: "Inventario de Materias Primas", url: createPageUrl("InventarioProduccion"), icon: Package },
            { title: "Inventario de Insumos y Químicos", url: createPageUrl("InventarioInsumos"), icon: Package },
            { title: "Inventario Productos en Proceso", url: createPageUrl("InventarioEnProceso"), icon: Package },
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
        title: "Seguimiento de Producción",
        icon: TrendingUp,
        roles: ["admin", "operario"],
        subItems: [
            { title: "Seguimiento General de Producción", url: createPageUrl("SeguimientoProduccion"), icon: TrendingUp }
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
            <li className="overflow-hidden">
                <button
                    onClick={() => toggleMenu(item.title)}
                    className="w-full flex items-center justify-between p-3 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-all duration-200 group"
                    title={isCollapsed ? item.title : ''}
                >
                    <div className="flex items-center space-x-3 whitespace-nowrap">
                        <item.icon className="w-5 h-5 group-hover:text-emerald-600 flex-shrink-0" />
                        <span className={`font-medium transition-opacity duration-300 ${isCollapsed ? 'opacity-0 select-none' : 'opacity-100'}`}>{item.title}</span>
                    </div>
                    <div className={`flex-shrink-0 transition-opacity duration-300 ${isCollapsed ? 'opacity-0 select-none' : 'opacity-100'}`}>
                        {expandedMenus[item.title] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                </button>
                <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenus[item.title] && !isCollapsed ? 'max-h-[1200px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                    <ul className="ml-4 space-y-1">
                        {item.subItems.map((subItem) => {
                            const isSubVisible = subItem.roles ? userHasRole(subItem.roles) : true;
                            if (!isSubVisible) return null;

                            // Si el subitem tiene subItems (submenú de nivel 2)
                            if (subItem.subItems) {
                                return (
                                    <li key={subItem.title} className="overflow-hidden">
                                        <button
                                            onClick={() => toggleMenu(subItem.title)}
                                            className="w-full flex items-center justify-between p-2 pl-4 text-sm rounded-md transition-all duration-200 text-slate-600 hover:bg-gray-100 hover:text-slate-800"
                                        >
                                            <span className="whitespace-nowrap">{subItem.title}</span>
                                            {expandedMenus[subItem.title] ? <ChevronDown className="w-3 h-3 flex-shrink-0" /> : <ChevronRight className="w-3 h-3 flex-shrink-0" />}
                                        </button>
                                        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedMenus[subItem.title] ? 'max-h-[800px] opacity-100 mt-1' : 'max-h-0 opacity-0 mt-0 pointer-events-none'}`}>
                                            <ul className="ml-4 space-y-1">
                                                {subItem.subItems.map((subSubItem) => {
                                                    const isPinned = pinnedShortcuts.some(s => s.url === subSubItem.url);
                                                    return (
                                                        <li key={subSubItem.title} className="flex items-center group overflow-hidden">
                                                            <Link
                                                                to={subSubItem.url}
                                                                className={`flex-grow block p-2 pl-6 text-xs rounded-md transition-all duration-200 whitespace-nowrap ${isActiveLink(subSubItem.url) ? 'bg-emerald-100 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-gray-100 hover:text-slate-800'}`}
                                                                onClick={() => setSidebarOpen(false)}
                                                            >
                                                                {subSubItem.title}
                                                            </Link>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    e.stopPropagation();
                                                                    togglePin(subSubItem.url, subSubItem.title, subSubItem.icon?.name || 'Settings');
                                                                }}
                                                                className="p-2 text-slate-400 hover:text-yellow-500 transition-colors group-hover:opacity-100 opacity-60"
                                                                title={isPinned ? "Quitar de accesos directos" : "Fijar en accesos directos"}
                                                            >
                                                                <Star className={`w-3 h-3 ${isPinned ? 'fill-yellow-400 text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`} />
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </div>
                                    </li>
                                );
                            }

                            const isPinned = pinnedShortcuts.some(s => s.url === subItem.url);
                            return (
                                <li key={subItem.title} className="flex items-center group overflow-hidden">
                                    <Link
                                        to={subItem.url}
                                        className={`flex-grow block p-2 pl-4 text-sm rounded-md transition-all duration-200 whitespace-nowrap ${isActiveLink(subItem.url) ? 'bg-emerald-100 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-gray-100 hover:text-slate-800'}`}
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
                                        className="p-2 text-slate-400 hover:text-yellow-500 transition-colors group-hover:opacity-100 opacity-60 flex-shrink-0"
                                        title={isPinned ? "Quitar de accesos directos" : "Fijar en accesos directos"}
                                    >
                                        <Star className={`w-4 h-4 ${isPinned ? 'fill-yellow-400 text-yellow-500' : 'text-slate-400 hover:text-yellow-500'}`} />
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </li>
        );
    }

    // Para ítems de menú que no tienen subítems (como "Inicio")
    const isPinned = pinnedShortcuts.some(s => s.url === item.url);
    return (
        <li className="flex items-center group overflow-hidden">
            <Link
                to={item.url}
                className={`flex-grow flex items-center space-x-3 p-3 rounded-lg transition-all duration-200 whitespace-nowrap ${isActiveLink(item.url) ? 'bg-emerald-100 text-emerald-700' : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'}`}
                onClick={() => setSidebarOpen(false)}
                title={isCollapsed ? item.title : ''}
            >
                <item.icon className="w-5 h-5 group-hover:text-emerald-600 flex-shrink-0" />
                <span className={`font-medium transition-opacity duration-300 ${isCollapsed ? 'opacity-0 select-none' : 'opacity-100'}`}>{item.title}</span>
            </Link>
            <div className={`transition-opacity duration-300 ${isCollapsed ? 'opacity-0 w-0 select-none' : 'opacity-100'} flex-shrink-0`}>
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
            </div>
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
    const [searchResults, setSearchResults] = useState(null); // null = sin búsqueda activa
    const clearSearchRef = useRef(null);
    const clearSearchTimerRef = useRef(null);

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
    const sidebarWidth = isCollapsed ? 'w-16' : 'w-[280px]';

    return (
        <div className="h-screen w-full bg-gray-50 flex overflow-hidden">
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
                    flex flex-col flex-shrink-0 h-full fixed lg:static inset-y-0 left-0 z-50 overflow-x-hidden ${sidebarWidth} bg-white shadow-xl transform transition-all duration-300 ease-in-out
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}
                onMouseEnter={() => {
                    setIsHovering(true);
                    if (clearSearchTimerRef.current) clearTimeout(clearSearchTimerRef.current);
                }}
                onMouseLeave={() => {
                    setIsHovering(false);
                    // Borrar búsqueda 3s después de que el cursor salga
                    clearSearchTimerRef.current = setTimeout(() => {
                        if (clearSearchRef.current) clearSearchRef.current();
                    }, 3000);
                }}
            >
                <div className="h-20 flex-shrink-0 bg-gradient-to-r from-stone-100 to-stone-200 border-b border-stone-300 flex items-center justify-between px-3">
                    <div className="flex items-center space-x-3 whitespace-nowrap overflow-hidden">
                        <img
                            src="https://i.ibb.co/q36LpTDQ/artecueros-logo.png"
                            alt="ArteCueros Logo"
                            className="h-10 w-10 object-contain flex-shrink-0"
                            onError={(e) => {
                                e.currentTarget.onerror = null;
                                e.currentTarget.src =
                                    "https://cdn-icons-png.flaticon.com/512/1973/1973885.png";
                                e.currentTarget.style.backgroundColor = "white";
                                e.currentTarget.style.padding = "2px";
                                e.currentTarget.style.borderRadius = "8px";
                            }}
                        />
                        <div className={`transition-opacity duration-300 ${isCollapsed ? 'opacity-0 select-none' : 'opacity-100'}`}>
                            <h1 className="text-stone-800 font-bold text-lg">ArteCueros</h1>
                            <p className="text-stone-600 text-xs">Mejía</p>
                        </div>
                    </div>
                    <div className={`transition-opacity duration-300 lg:hidden ${isCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-stone-600 hover:bg-stone-200"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                    </div>
                </div>

                <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 min-h-0 custom-scrollbar">
                    <SidebarSearch
                        menuItems={menuItems}
                        isCollapsed={isCollapsed}
                        onSearchResults={setSearchResults}
                        onClear={clearSearchRef}
                    />
                    <ul className="space-y-1">
                        {menuItems.map((item) => {
                            const isVisible = item.roles ? userHasRole(item.roles) : true;
                            if (!isVisible) return null;

                            // Si hay búsqueda activa, filtrar items
                            if (searchResults !== null) {
                                // "Inicio" (sin subItems) siempre visible
                                if (!item.subItems) {
                                    return (
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
                                    );
                                }
                                // Módulo no en resultados → ocultar
                                if (!(item.title in searchResults)) return null;
                                // Crear item filtrado con solo los subItems que matchean
                                const matchedSubs = searchResults[item.title];
                                const filteredItem = matchedSubs ? { ...item, subItems: matchedSubs } : item;
                                // Forzar expandido
                                const forcedExpandedMenus = { ...expandedMenus, [item.title]: true };
                                // También expandir sub-niveles 2 si existen
                                if (matchedSubs) {
                                    matchedSubs.forEach(s => { if (s.subItems) forcedExpandedMenus[s.title] = true; });
                                }
                                return (
                                    <MenuItem
                                        key={item.title}
                                        item={filteredItem}
                                        expandedMenus={forcedExpandedMenus}
                                        toggleMenu={toggleMenu}
                                        isActiveLink={isActiveLink}
                                        togglePin={togglePin}
                                        pinnedShortcuts={pinnedShortcuts}
                                        setSidebarOpen={setSidebarOpen}
                                        userHasRole={userHasRole}
                                        isCollapsed={isCollapsed}
                                    />
                                );
                            }

                            return (
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
                            );
                        })}
                    </ul>
                </nav>

                <div className="flex-shrink-0 p-2 border-t border-gray-200 bg-white">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center space-x-3 p-3 text-red-600 hover:bg-red-50 rounded-lg transition-all duration-200 group overflow-hidden whitespace-nowrap"
                        title={isCollapsed ? "Salir" : ''}
                    >
                        <LogOut className="w-5 h-5 flex-shrink-0" />
                        <span className={`font-medium transition-opacity duration-300 ${isCollapsed ? 'opacity-0 select-none' : 'opacity-100'}`}>Salir</span>
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
                <header className="h-20 flex-shrink-0 bg-white shadow-sm border-b border-gray-200 flex items-center justify-between px-6 z-10">
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
                            <p className="text-sm text-slate-500 hidden sm:block">Sistema de Gestión - ArteCueros Mejía</p>
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 bg-gray-50 custom-scrollbar relative">
                    {children}
                </div>
            </main>

            {/* Copiloto ERP - Chat Flotante Global */}
            <ChatBotFloating agentName="copiloto_erp" />
            
            {/* Custom scrollbar styles global */}
            <style>
                {`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: rgba(156, 163, 175, 0.5);
                    border-radius: 20px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(107, 114, 128, 0.8);
                }
                `}
            </style>
        </div>
    );
}