/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import ProcesoCurtido from './pages/ProcesoCurtido';
import AdminUnidadesMedida from './pages/AdminUnidadesMedida';
import RecetasPintura from './pages/RecetasPintura';
import ContabilidadPagar from './pages/ContabilidadPagar';
import CajaConfig from './pages/CajaConfig';
import InformeCostos from './pages/InformeCostos';
import VerConsolidadoDetalle from './pages/VerConsolidadoDetalle';
import ProduccionConsumoInsumos from './pages/ProduccionConsumoInsumos';
import ConsolidadosGenerales from './pages/ConsolidadosGenerales';
import TrasladoInventario from './pages/TrasladoInventario';
import CostosServicioManoObra from './pages/CostosServicioManoObra';
import BilleterasDigitales from './pages/BilleterasDigitales';
import Pintura from './pages/Pintura';
import EgresosBancarios from './pages/EgresosBancarios';
import PedidosIndividuales from './pages/PedidosIndividuales';
import AdminServicios from './pages/AdminServicios';
import AdminTerceros from './pages/AdminTerceros';
import InventarioProductos from './pages/InventarioProductos';
import CatalogoColores from './pages/CatalogoColores';
import CajaMovimientos from './pages/CajaMovimientos';
import ReportesCompras from './pages/ReportesCompras';
import ReciboCaja from './pages/ReciboCaja';
import CuentasPorCobrar from './pages/CuentasPorCobrar';
import ReportesProcesos from './pages/ReportesProcesos';
import GestionPedidos from './pages/GestionPedidos';
import InventarioEnProceso from './pages/InventarioEnProceso';
import ReportesFinancieros from './pages/ReportesFinancieros';
import ProduccionPlanificacion from './pages/ProduccionPlanificacion';
import PlanCuentas from './pages/PlanCuentas';
import CostosIndirectos from './pages/CostosIndirectos';
import ReportesInventario from './pages/ReportesInventario';
import CuentasPorPagar from './pages/CuentasPorPagar';
import ServiciosProduccion from './pages/ServiciosProduccion';
import CajaBancos from './pages/CajaBancos';
import ReportesVentas from './pages/ReportesVentas';
import InformeCaja from './pages/InformeCaja';
import AjusteInicialInventario from './pages/AjusteInicialInventario';
import InventarioInsumos from './pages/InventarioInsumos';
import TransferenciasBancarias from './pages/TransferenciasBancarias';
import AdminActividades from './pages/AdminActividades';
import PedidoNuevo from './pages/PedidoNuevo';
import VentaServicios from './pages/VentaServicios';
import CostosServicioMaquinaria from './pages/CostosServicioMaquinaria';
import MovimientosBancarios from './pages/MovimientosBancarios';
import RHNomina from './pages/RHNomina';
import CajaTransferencias from './pages/CajaTransferencias';
import ComprobanteEgreso from './pages/ComprobanteEgreso';
import InventarioProduccion from './pages/InventarioProduccion';
import ContabilidadGastos from './pages/ContabilidadGastos';
import LibroDiarioNuevo from './pages/LibroDiarioNuevo';
import LibroMayor from './pages/LibroMayor';
import ProcesoRecurtido from './pages/ProcesoRecurtido';
import ContabilidadIngresos from './pages/ContabilidadIngresos';
import ProcesoAcabado from './pages/ProcesoAcabado';
import ConciliacionBancaria from './pages/ConciliacionBancaria';
import ContabilidadTraslados from './pages/ContabilidadTraslados';
import ReporteCuentas from './pages/ReporteCuentas';
import ConsolidarPedidos from './pages/ConsolidarPedidos';
import ProduccionOrdenes from './pages/ProduccionOrdenes';
import ProduccionReporteEtapas from './pages/ProduccionReporteEtapas';
import IngresosBancarios from './pages/IngresosBancarios';
import CatalogoProductos from './pages/CatalogoProductos';
import LoteDetalladoConsolidado from './pages/LoteDetalladoConsolidado';
import Dashboard from './pages/Dashboard';
import CompraInsumos from './pages/CompraInsumos';
import RolesPermisos from './pages/RolesPermisos';
import RHEmpleados from './pages/RHEmpleados';
import ContabilidadCobrar from './pages/ContabilidadCobrar';
import UsuariosSistema from './pages/UsuariosSistema';
import ProcesoRecepcion from './pages/ProcesoRecepcion';
import LibroDiario from './pages/LibroDiario';
import ReportesProduccion from './pages/ReportesProduccion';
import VentaProductos from './pages/VentaProductos';
import ProcesoLimpieza from './pages/ProcesoLimpieza';
import ReportesBancarios from './pages/ReportesBancarios';
import ReportesMovimientosCaja from './pages/ReportesMovimientosCaja';
import CuentasBancarias from './pages/CuentasBancarias';
import CostosOtrosCostos from './pages/CostosOtrosCostos';
import RHAsistencia from './pages/RHAsistencia';
import AdminTiposGasto from './pages/AdminTiposGasto';
import AjusteInventario from './pages/AjusteInventario';
import __Layout from './Layout.jsx';


export const PAGES = {
    "ProcesoCurtido": ProcesoCurtido,
    "AdminUnidadesMedida": AdminUnidadesMedida,
    "RecetasPintura": RecetasPintura,
    "ContabilidadPagar": ContabilidadPagar,
    "CajaConfig": CajaConfig,
    "InformeCostos": InformeCostos,
    "VerConsolidadoDetalle": VerConsolidadoDetalle,
    "ProduccionConsumoInsumos": ProduccionConsumoInsumos,
    "ConsolidadosGenerales": ConsolidadosGenerales,
    "TrasladoInventario": TrasladoInventario,
    "CostosServicioManoObra": CostosServicioManoObra,
    "BilleterasDigitales": BilleterasDigitales,
    "Pintura": Pintura,
    "EgresosBancarios": EgresosBancarios,
    "PedidosIndividuales": PedidosIndividuales,
    "AdminServicios": AdminServicios,
    "AdminTerceros": AdminTerceros,
    "InventarioProductos": InventarioProductos,
    "CatalogoColores": CatalogoColores,
    "CajaMovimientos": CajaMovimientos,
    "ReportesCompras": ReportesCompras,
    "ReciboCaja": ReciboCaja,
    "CuentasPorCobrar": CuentasPorCobrar,
    "ReportesProcesos": ReportesProcesos,
    "GestionPedidos": GestionPedidos,
    "InventarioEnProceso": InventarioEnProceso,
    "ReportesFinancieros": ReportesFinancieros,
    "ProduccionPlanificacion": ProduccionPlanificacion,
    "PlanCuentas": PlanCuentas,
    "CostosIndirectos": CostosIndirectos,
    "ReportesInventario": ReportesInventario,
    "CuentasPorPagar": CuentasPorPagar,
    "ServiciosProduccion": ServiciosProduccion,
    "CajaBancos": CajaBancos,
    "ReportesVentas": ReportesVentas,
    "InformeCaja": InformeCaja,
    "AjusteInicialInventario": AjusteInicialInventario,
    "InventarioInsumos": InventarioInsumos,
    "TransferenciasBancarias": TransferenciasBancarias,
    "AdminActividades": AdminActividades,
    "PedidoNuevo": PedidoNuevo,
    "VentaServicios": VentaServicios,
    "CostosServicioMaquinaria": CostosServicioMaquinaria,
    "MovimientosBancarios": MovimientosBancarios,
    "RHNomina": RHNomina,
    "CajaTransferencias": CajaTransferencias,
    "ComprobanteEgreso": ComprobanteEgreso,
    "InventarioProduccion": InventarioProduccion,
    "ContabilidadGastos": ContabilidadGastos,
    "LibroDiarioNuevo": LibroDiarioNuevo,
    "LibroMayor": LibroMayor,
    "ProcesoRecurtido": ProcesoRecurtido,
    "ContabilidadIngresos": ContabilidadIngresos,
    "ProcesoAcabado": ProcesoAcabado,
    "ConciliacionBancaria": ConciliacionBancaria,
    "ContabilidadTraslados": ContabilidadTraslados,
    "ReporteCuentas": ReporteCuentas,
    "ConsolidarPedidos": ConsolidarPedidos,
    "ProduccionOrdenes": ProduccionOrdenes,
    "ProduccionReporteEtapas": ProduccionReporteEtapas,
    "IngresosBancarios": IngresosBancarios,
    "CatalogoProductos": CatalogoProductos,
    "LoteDetalladoConsolidado": LoteDetalladoConsolidado,
    "Dashboard": Dashboard,
    "CompraInsumos": CompraInsumos,
    "RolesPermisos": RolesPermisos,
    "RHEmpleados": RHEmpleados,
    "ContabilidadCobrar": ContabilidadCobrar,
    "UsuariosSistema": UsuariosSistema,
    "ProcesoRecepcion": ProcesoRecepcion,
    "LibroDiario": LibroDiario,
    "ReportesProduccion": ReportesProduccion,
    "VentaProductos": VentaProductos,
    "ProcesoLimpieza": ProcesoLimpieza,
    "ReportesBancarios": ReportesBancarios,
    "ReportesMovimientosCaja": ReportesMovimientosCaja,
    "CuentasBancarias": CuentasBancarias,
    "CostosOtrosCostos": CostosOtrosCostos,
    "RHAsistencia": RHAsistencia,
    "AdminTiposGasto": AdminTiposGasto,
    "AjusteInventario": AjusteInventario,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};