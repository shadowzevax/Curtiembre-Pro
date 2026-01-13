import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

export default function StockAlert({ stockActual, stockMinimo, className = "" }) {
    const percentage = stockMinimo > 0 ? (stockActual / stockMinimo) * 100 : 100;
    
    let icon, color, bgColor, status;
    
    if (stockActual <= 0) {
        icon = <AlertCircle className="w-4 h-4" />;
        color = "text-red-700";
        bgColor = "bg-red-100";
        status = "SIN STOCK";
    } else if (stockActual <= stockMinimo) {
        icon = <AlertCircle className="w-4 h-4" />;
        color = "text-red-700";
        bgColor = "bg-red-100";
        status = "CRÍTICO";
    } else if (percentage <= 150) {
        icon = <AlertTriangle className="w-4 h-4" />;
        color = "text-yellow-700";
        bgColor = "bg-yellow-100";
        status = "BAJO";
    } else {
        icon = <CheckCircle className="w-4 h-4" />;
        color = "text-green-700";
        bgColor = "bg-green-100";
        status = "NORMAL";
    }
    
    return (
        <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${bgColor} ${color} ${className}`}>
            {icon}
            <span className="text-xs font-semibold">{status}</span>
        </div>
    );
}