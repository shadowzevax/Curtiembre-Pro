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
import AdminActividades from './pages/AdminActividades';
import AdminServicios from './pages/AdminServicios';
import AdminTerceros from './pages/AdminTerceros';
import AdminTiposGasto from './pages/AdminTiposGasto';
import AdminUnidadesMedida from './pages/AdminUnidadesMedida';
import AjusteInventario from './pages/AjusteInventario';
import BilleterasDigitales from './pages/BilleterasDigitales';
import CajaBancos from './pages/CajaBancos';
import CajaConfig from './pages/CajaConfig';
import CajaMovimientos from './pages/CajaMovimientos';
import CajaTransferencias from './pages/CajaTransferencias';
import CatalogoColores from './pages/CatalogoColores';
import CatalogoProductos from './pages/CatalogoProductos';
import CompraInsumos from './pages/CompraInsumos';
import ComprobanteEgreso from './pages/ComprobanteEgreso';
import ConciliacionBancaria from './pages/ConciliacionBancaria';
import ConsolidadosGenerales from './pages/ConsolidadosGenerales';
import ConsolidarPedidos from './pages/ConsolidarPedidos';
import ContabilidadCobrar from './pages/ContabilidadCobrar';
import ContabilidadGastos from './pages/ContabilidadGastos';
import ContabilidadIngresos from './pages/ContabilidadIngresos';
import ContabilidadPagar from './pages/ContabilidadPagar';
import ContabilidadTraslados from './pages/ContabilidadTraslados';
import CostosIndirectos from './pages/CostosIndirectos';
import CostosOtrosCostos from './pages/CostosOtrosCostos';
import CostosServicioManoObra from './pages/CostosServicioManoObra';
import CostosServicioMaquinaria from './pages/CostosServicioMaquinaria';
import CuentasBancarias from './pages/CuentasBancarias';
import Dashboard from './pages/Dashboard';
import EgresosBancarios from './pages/EgresosBancarios';
import GestionPedidos from './pages/GestionPedidos';
import InformeCaja from './pages/InformeCaja';
import InformeCostos from './pages/InformeCostos';
import IngresosBancarios from './pages/IngresosBancarios';
import InventarioEnProceso from './pages/InventarioEnProceso';
import InventarioInsumos from './pages/InventarioInsumos';
import InventarioProduccion from './pages/InventarioProduccion';
import InventarioProductos from './pages/InventarioProductos';
import LibroDiario from './pages/LibroDiario';
import LibroDiarioNuevo from './pages/LibroDiarioNuevo';
import LibroMayor from './pages/LibroMayor';
import PedidoNuevo from './pages/PedidoNuevo';
import PedidosIndividuales from './pages/PedidosIndividuales';
import Pintura from './pages/Pintura';
import PlanCuentas from './pages/PlanCuentas';
import ProcesoAcabado from './pages/ProcesoAcabado';
import ProcesoCurtido from './pages/ProcesoCurtido';
import ProcesoLimpieza from './pages/ProcesoLimpieza';
import ProcesoRecepcion from './pages/ProcesoRecepcion';
import ProcesoRecurtido from './pages/ProcesoRecurtido';
import ProduccionConsumoInsumos from './pages/ProduccionConsumoInsumos';
import ProduccionOrdenes from './pages/ProduccionOrdenes';
import ProduccionPlanificacion from './pages/ProduccionPlanificacion';
import ProduccionReporteEtapas from './pages/ProduccionReporteEtapas';
import RHAsistencia from './pages/RHAsistencia';
import RHEmpleados from './pages/RHEmpleados';
import RHNomina from './pages/RHNomina';
import RecetasPintura from './pages/RecetasPintura';
import ReciboCaja from './pages/ReciboCaja';
import ReporteCuentas from './pages/ReporteCuentas';
import ReportesCompras from './pages/ReportesCompras';
import ReportesFinancieros from './pages/ReportesFinancieros';
import ReportesInventario from './pages/ReportesInventario';
import ReportesProcesos from './pages/ReportesProcesos';
import ReportesProduccion from './pages/ReportesProduccion';
import ReportesVentas from './pages/ReportesVentas';
import RolesPermisos from './pages/RolesPermisos';
import ServiciosProduccion from './pages/ServiciosProduccion';
import TrasladoInventario from './pages/TrasladoInventario';
import UsuariosSistema from './pages/UsuariosSistema';
import VentaProductos from './pages/VentaProductos';
import VentaServicios from './pages/VentaServicios';
import VerConsolidadoDetalle from './pages/VerConsolidadoDetalle';
import MovimientosBancarios from './pages/MovimientosBancarios';
import ReportesMovimientosCaja from './pages/ReportesMovimientosCaja';
import TransferenciasBancarias from './pages/TransferenciasBancarias';
import ReportesBancarios from './pages/ReportesBancarios';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminActividades": AdminActividades,
    "AdminServicios": AdminServicios,
    "AdminTerceros": AdminTerceros,
    "AdminTiposGasto": AdminTiposGasto,
    "AdminUnidadesMedida": AdminUnidadesMedida,
    "AjusteInventario": AjusteInventario,
    "BilleterasDigitales": BilleterasDigitales,
    "CajaBancos": CajaBancos,
    "CajaConfig": CajaConfig,
    "CajaMovimientos": CajaMovimientos,
    "CajaTransferencias": CajaTransferencias,
    "CatalogoColores": CatalogoColores,
    "CatalogoProductos": CatalogoProductos,
    "CompraInsumos": CompraInsumos,
    "ComprobanteEgreso": ComprobanteEgreso,
    "ConciliacionBancaria": ConciliacionBancaria,
    "ConsolidadosGenerales": ConsolidadosGenerales,
    "ConsolidarPedidos": ConsolidarPedidos,
    "ContabilidadCobrar": ContabilidadCobrar,
    "ContabilidadGastos": ContabilidadGastos,
    "ContabilidadIngresos": ContabilidadIngresos,
    "ContabilidadPagar": ContabilidadPagar,
    "ContabilidadTraslados": ContabilidadTraslados,
    "CostosIndirectos": CostosIndirectos,
    "CostosOtrosCostos": CostosOtrosCostos,
    "CostosServicioManoObra": CostosServicioManoObra,
    "CostosServicioMaquinaria": CostosServicioMaquinaria,
    "CuentasBancarias": CuentasBancarias,
    "Dashboard": Dashboard,
    "EgresosBancarios": EgresosBancarios,
    "GestionPedidos": GestionPedidos,
    "InformeCaja": InformeCaja,
    "InformeCostos": InformeCostos,
    "IngresosBancarios": IngresosBancarios,
    "InventarioEnProceso": InventarioEnProceso,
    "InventarioInsumos": InventarioInsumos,
    "InventarioProduccion": InventarioProduccion,
    "InventarioProductos": InventarioProductos,
    "LibroDiario": LibroDiario,
    "LibroDiarioNuevo": LibroDiarioNuevo,
    "LibroMayor": LibroMayor,
    "PedidoNuevo": PedidoNuevo,
    "PedidosIndividuales": PedidosIndividuales,
    "Pintura": Pintura,
    "PlanCuentas": PlanCuentas,
    "ProcesoAcabado": ProcesoAcabado,
    "ProcesoCurtido": ProcesoCurtido,
    "ProcesoLimpieza": ProcesoLimpieza,
    "ProcesoRecepcion": ProcesoRecepcion,
    "ProcesoRecurtido": ProcesoRecurtido,
    "ProduccionConsumoInsumos": ProduccionConsumoInsumos,
    "ProduccionOrdenes": ProduccionOrdenes,
    "ProduccionPlanificacion": ProduccionPlanificacion,
    "ProduccionReporteEtapas": ProduccionReporteEtapas,
    "RHAsistencia": RHAsistencia,
    "RHEmpleados": RHEmpleados,
    "RHNomina": RHNomina,
    "RecetasPintura": RecetasPintura,
    "ReciboCaja": ReciboCaja,
    "ReporteCuentas": ReporteCuentas,
    "ReportesCompras": ReportesCompras,
    "ReportesFinancieros": ReportesFinancieros,
    "ReportesInventario": ReportesInventario,
    "ReportesProcesos": ReportesProcesos,
    "ReportesProduccion": ReportesProduccion,
    "ReportesVentas": ReportesVentas,
    "RolesPermisos": RolesPermisos,
    "ServiciosProduccion": ServiciosProduccion,
    "TrasladoInventario": TrasladoInventario,
    "UsuariosSistema": UsuariosSistema,
    "VentaProductos": VentaProductos,
    "VentaServicios": VentaServicios,
    "VerConsolidadoDetalle": VerConsolidadoDetalle,
    "MovimientosBancarios": MovimientosBancarios,
    "ReportesMovimientosCaja": ReportesMovimientosCaja,
    "TransferenciasBancarias": TransferenciasBancarias,
    "ReportesBancarios": ReportesBancarios,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};