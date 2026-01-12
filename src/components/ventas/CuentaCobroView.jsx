import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

const formatCurrency = (amount) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(amount || 0);

export default function CuentaCobroView({ orden, cliente }) {
    if (!orden || !cliente) return null;
    
    const handlePrint = () => {
        const printContents = document.getElementById('cuenta-cobro-printable').innerHTML;
        const originalContents = document.body.innerHTML;
        document.body.innerHTML = printContents;
        window.print();
        document.body.innerHTML = originalContents;
        window.location.reload();
    };

    const MIN_ROWS = 12;
    const emptyRowCount = Math.max(0, MIN_ROWS - (orden.items?.length || 0));
    const emptyRows = Array.from({ length: emptyRowCount });

    return (
        <div className="bg-gray-100 p-4 max-h-[90vh] overflow-y-auto">
             <div className="flex justify-end mb-4 no-print">
                <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Imprimir</Button>
            </div>
            <div id="cuenta-cobro-printable">
                <style>{`
                    @media print {
                        body, .invoice-container { margin: 0; padding: 0; box-shadow: none; background: white; }
                        .no-print { display: none; }
                    }
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    .invoice-container { width: 210mm; min-height: 270mm; background: white; margin: 0 auto; padding: 20px 20px 1px 20px; font-family: Arial, sans-serif; color: #000; }
                    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 10px; }
                    .logo-section { display: flex; flex-direction: column; align-items: center; width: 200px; }
                    .logo { width: 95px; height: 95px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: white; }
                    .logo img { width: 100%; height: 100%; object-fit: contain; }
                    .company-info { flex: 1; text-align: center; padding: 0 20px; }
                    .company-info h2 { font-size: 15px; margin-bottom: 5px; font-weight: normal; }
                    .company-info p { margin: 2px 0; font-size: 13px; }
                    .tagline { font-style: italic; font-size: 16px; margin: 1px 0; }
                    .company-info .subtitle-text { font-style: italic; font-size: 14px; color: #333; }
                    .remision-box { border: 2px solid #000; border-radius: 10px; padding: 8px 15px; width: 180px; text-align: center; }
                    .remision-box .title { font-weight: bold; font-size: 13px; margin-bottom: 5px; }
                    .remision-box .number { font-size: 24px; font-weight: bold; }
                    .info-row { display: flex; border: 2px solid #000; border-bottom: none; }
                    .info-row-last { border-bottom: 2px solid #000; margin-bottom: 20px; }
                    .info-row .field { padding: 6px 12px; border-right: 2px solid #000; flex: 1; display: flex; align-items: center;}
                    .info-row .field:last-child { border-right: none; }
                    .info-row .field label { font-weight: bold; font-size: 13px; margin-right: 8px;}
                    .table-container { border: 2px solid #000; margin-bottom: 30px; }
                    .table-header { display: flex; background: #c0c0c0; border-bottom: 2px solid #000; }
                    .table-header div { padding: 10px; font-weight: bold; font-size: 13px; border-right: 2px solid #000; text-align: center; }
                    .table-header div:last-child { border-right: none; }
                    .col-cant-small { width: 80px; } .col-descripcion { flex: 1; } .col-vr { width: 110px; }
                    .table-rows { display: flex; flex-direction: column; }
                    .table-row { display: flex; border-bottom: 1px solid #000; min-height: 30px; }
                    .table-row:last-child { border-bottom: none; }
                    .table-row div { padding: 6px; border-right: 2px solid #000; }
                    .table-row div:last-child { border-right: none; }
                    .table-footer { display: flex; flex-direction: column; border-top: 2px solid #000; }
                    .footer-row { display: flex; }
                    .footer-label { width: calc(100% - 220px); padding: 6px; text-align: right; font-weight: bold; border-right: 2px solid #000; border-bottom: 1px solid #000; background: #c0c0c0; }
                    .footer-value { width: 220px; padding: 6px; border-bottom: 1px solid #000; background: #e8e8e8; text-align: right; }
                    .footer-row:last-child .footer-label, .footer-row:last-child .footer-value { border-bottom: none; }
                    .signature-section { margin-top: 40px; }
                    .signature-field { margin-bottom: 20px; }
                    .signature-field:last-child { margin-bottom: 0; }
                    .signature-field label { font-weight: bold; font-size: 14px; margin-right: 20px; }
                    .signature-field .line { display: inline-block; width: 400px; border-bottom: 1px solid #000; }
                `}</style>
                <div className="invoice-container">
                    <div className="header">
                        <div className="logo-section">
                            <div className="logo">
                                <img src="https://www.artecueros.com/wp-content/uploads/2025/05/logogrande.png" alt="Arte Cueros Logo" />
                            </div>
                        </div>
                        <div className="company-info">
                            <h2>Marroquineria Artecueros</h2>
                            <h2 style={{ fontSize: '13px' }}>CALLE 19 A No. 46 - 102 POLVORIN - PASTO -NARIÑO</h2>
                            <p>produccion@artecueros.com</p>
                            <p className="tagline">Artículos de Cuero...</p>
                            <p className="subtitle-text">Hechos con pasión en Colombia</p>
                        </div>
                        <div className="remision-box">
                            <div className="title">CUENTA DE COBRO</div>
                            <div className="number">No. {orden.numero_documento}</div>
                        </div>
                    </div>
                    <div className="info-row">
                        <div className="field" style={{ flex: '0 0 100px' }}><label>Fecha:</label><span>{new Date(orden.fecha_orden).toLocaleDateString('es-CO')}</span></div>
                        <div className="field" style={{ flexGrow: 3 }}><label>Cliente:</label><span>{cliente.nombre}</span></div>
                    </div>
                    <div className="info-row info-row-last">
                        <div className="field" style={{ flexGrow: 3 }}><label>Direccion:</label><span>{orden.direccion_cliente || cliente.direccion}</span></div>
                        <div className="field"><label>Tel.:</label><span>{orden.telefono_cliente || cliente.telefono}</span></div>
                    </div>
                    <div className="table-container">
                        <div className="table-header">
                            <div className="col-cant-small">CANT.</div>
                            <div className="col-descripcion">DESCRIPCIÓN</div>
                            <div className="col-vr">VR. UNIT</div>
                            <div className="col-vr">VR. TOTAL</div>
                        </div>
                        <div className="table-rows">
                            {orden.items.map((item, index) => (
                                <div className="table-row" key={index}>
                                    <div className="col-cant-small" style={{textAlign: 'center'}}>{item.cantidad}</div>
                                    <div className="col-descripcion">{item.descripcion}</div>
                                    <div className="col-vr" style={{textAlign: 'right'}}>{formatCurrency(item.precio_unitario)}</div>
                                    <div className="col-vr" style={{textAlign: 'right'}}>{formatCurrency(item.subtotal)}</div>
                                </div>
                            ))}
                             {emptyRows.map((_, index) => (
                                <div className="table-row" key={`empty-${index}`}>
                                    <div className="col-cant-small">&nbsp;</div>
                                    <div className="col-descripcion">&nbsp;</div>
                                    <div className="col-vr">&nbsp;</div>
                                    <div className="col-vr">&nbsp;</div>
                                </div>
                            ))}
                        </div>
                        <div className="table-footer">
                            <div className="footer-row">
                                <div className="footer-label">Total Bruto:</div>
                                <div className="footer-value">{formatCurrency(orden.subtotal)}</div>
                            </div>
                            <div className="footer-row">
                                <div className="footer-label">IVA:</div>
                                <div className="footer-value">{formatCurrency(orden.iva_total)}</div>
                            </div>
                            <div className="footer-row">
                                <div className="footer-label">SubTotal:</div>
                                <div className="footer-value">{formatCurrency(orden.subtotal + orden.iva_total)}</div>
                            </div>
                            <div className="footer-row">
                                <div className="footer-label">RetenFte.:</div>
                                <div className="footer-value">{formatCurrency(orden.retefuente_total)}</div>
                            </div>
                            <div className="footer-row">
                                <div className="footer-label">TOTAL NETO A PAGAR:</div>
                                <div className="footer-value">{formatCurrency(orden.total)}</div>
                            </div>
                        </div>
                    </div>
                    <div className="signature-section">
                        <div className="signature-field">
                            <label>Firma y Sello Cliente:</label>
                            <span className="line"></span>
                        </div>
                        <div className="signature-field">
                            <label>C.C. o Nit.:</label>
                            <span className="line">{orden.cc_nit_cliente || cliente.nit}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}