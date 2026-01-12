import Dashboard from './pages/Dashboard';
import AdminTerceros from './pages/AdminTerceros';
import CompraInsumos from './pages/CompraInsumos';
import ProcesoRecepcion from './pages/ProcesoRecepcion';
import ProcesoLimpieza from './pages/ProcesoLimpieza';
import ProcesoCurtido from './pages/ProcesoCurtido';
import ProcesoAcabado from './pages/ProcesoAcabado';
import ProcesoRecurtido from './pages/ProcesoRecurtido';
import VentaProductos from './pages/VentaProductos';
import VentaServicios from './pages/VentaServicios';
import InventarioInsumos from './pages/InventarioInsumos';
import InventarioProduccion from './pages/InventarioProduccion';
import ContabilidadGastos from './pages/ContabilidadGastos';
import ContabilidadIngresos from './pages/ContabilidadIngresos';
import ContabilidadTraslados from './pages/ContabilidadTraslados';
import ContabilidadPagar from './pages/ContabilidadPagar';
import ContabilidadCobrar from './pages/ContabilidadCobrar';
import InformeCaja from './pages/InformeCaja';
import InformeCostos from './pages/InformeCostos';
import AdminActividades from './pages/AdminActividades';
import UsuariosSistema from './pages/UsuariosSistema';
import AdminServicios from './pages/AdminServicios';
import AdminUnidadesMedida from './pages/AdminUnidadesMedida';
import AdminTiposGasto from './pages/AdminTiposGasto';
import RHEmpleados from './pages/RHEmpleados';
import RHNomina from './pages/RHNomina';
import RHAsistencia from './pages/RHAsistencia';
import ReportesVentas from './pages/ReportesVentas';
import ReportesCompras from './pages/ReportesCompras';
import ReportesInventario from './pages/ReportesInventario';
import ReportesProduccion from './pages/ReportesProduccion';
import ReportesFinancieros from './pages/ReportesFinancieros';
import RolesPermisos from './pages/RolesPermisos';
import ProduccionOrdenes from './pages/ProduccionOrdenes';
import ProduccionPlanificacion from './pages/ProduccionPlanificacion';
import ProduccionConsumoInsumos from './pages/ProduccionConsumoInsumos';
import ProduccionReporteEtapas from './pages/ProduccionReporteEtapas';
import InventarioProductos from './pages/InventarioProductos';
import ReciboCaja from './pages/ReciboCaja';
import ComprobanteEgreso from './pages/ComprobanteEgreso';
import ReportesProcesos from './pages/ReportesProcesos';
import CostosIndirectos from './pages/CostosIndirectos';
import CostosServicioMaquinaria from './pages/CostosServicioMaquinaria';
import CostosServicioManoObra from './pages/CostosServicioManoObra';
import CostosOtrosCostos from './pages/CostosOtrosCostos';
import RecetasPintura from './pages/RecetasPintura';
import CatalogoProductos from './pages/CatalogoProductos';
import AjusteInventario from './pages/AjusteInventario';
import LibroDiario from './pages/LibroDiario';
import CajaMovimientos from './pages/CajaMovimientos';
import CajaTransferencias from './pages/CajaTransferencias';
import CajaConfig from './pages/CajaConfig';
import ServiciosProduccion from './pages/ServiciosProduccion';
import LibroDiarioNuevo from './pages/LibroDiarioNuevo';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Dashboard": Dashboard,
    "AdminTerceros": AdminTerceros,
    "CompraInsumos": CompraInsumos,
    "ProcesoRecepcion": ProcesoRecepcion,
    "ProcesoLimpieza": ProcesoLimpieza,
    "ProcesoCurtido": ProcesoCurtido,
    "ProcesoAcabado": ProcesoAcabado,
    "ProcesoRecurtido": ProcesoRecurtido,
    "VentaProductos": VentaProductos,
    "VentaServicios": VentaServicios,
    "InventarioInsumos": InventarioInsumos,
    "InventarioProduccion": InventarioProduccion,
    "ContabilidadGastos": ContabilidadGastos,
    "ContabilidadIngresos": ContabilidadIngresos,
    "ContabilidadTraslados": ContabilidadTraslados,
    "ContabilidadPagar": ContabilidadPagar,
    "ContabilidadCobrar": ContabilidadCobrar,
    "InformeCaja": InformeCaja,
    "InformeCostos": InformeCostos,
    "AdminActividades": AdminActividades,
    "UsuariosSistema": UsuariosSistema,
    "AdminServicios": AdminServicios,
    "AdminUnidadesMedida": AdminUnidadesMedida,
    "AdminTiposGasto": AdminTiposGasto,
    "RHEmpleados": RHEmpleados,
    "RHNomina": RHNomina,
    "RHAsistencia": RHAsistencia,
    "ReportesVentas": ReportesVentas,
    "ReportesCompras": ReportesCompras,
    "ReportesInventario": ReportesInventario,
    "ReportesProduccion": ReportesProduccion,
    "ReportesFinancieros": ReportesFinancieros,
    "RolesPermisos": RolesPermisos,
    "ProduccionOrdenes": ProduccionOrdenes,
    "ProduccionPlanificacion": ProduccionPlanificacion,
    "ProduccionConsumoInsumos": ProduccionConsumoInsumos,
    "ProduccionReporteEtapas": ProduccionReporteEtapas,
    "InventarioProductos": InventarioProductos,
    "ReciboCaja": ReciboCaja,
    "ComprobanteEgreso": ComprobanteEgreso,
    "ReportesProcesos": ReportesProcesos,
    "CostosIndirectos": CostosIndirectos,
    "CostosServicioMaquinaria": CostosServicioMaquinaria,
    "CostosServicioManoObra": CostosServicioManoObra,
    "CostosOtrosCostos": CostosOtrosCostos,
    "RecetasPintura": RecetasPintura,
    "CatalogoProductos": CatalogoProductos,
    "AjusteInventario": AjusteInventario,
    "LibroDiario": LibroDiario,
    "CajaMovimientos": CajaMovimientos,
    "CajaTransferencias": CajaTransferencias,
    "CajaConfig": CajaConfig,
    "ServiciosProduccion": ServiciosProduccion,
    "LibroDiarioNuevo": LibroDiarioNuevo,
}

export const pagesConfig = {
    mainPage: "Dashboard",
    Pages: PAGES,
    Layout: __Layout,
};