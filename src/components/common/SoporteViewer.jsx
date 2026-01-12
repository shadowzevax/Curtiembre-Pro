import React, { useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, Printer, DownloadCloud, FileText } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const isImage = (url) => /\.(jpeg|jpg|gif|png|svg)$/i.test(url);

export default function SoporteViewer({ open, onOpenChange, soportes, orden }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const downloadFile = useCallback(async (url, filename) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename || url.split('/').pop().split('?')[0]; // Clean URL
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error downloading file:', error);
        toast({
            title: "Error de descarga",
            description: `No se pudo descargar el archivo: ${filename}`,
            variant: "destructive",
        });
    }
  }, [toast]);
  
  const handleDownloadAll = useCallback(async () => {
      setIsDownloading(true);
      toast({
        title: "Iniciando descarga...",
        description: `Se descargarán ${soportes.length} archivos. Por favor, permite las descargas múltiples si tu navegador lo solicita.`,
      });

      for (let i = 0; i < soportes.length; i++) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Pequeña pausa para no saturar el navegador
          await downloadFile(soportes[i]);
      }
      
      setIsDownloading(false);
      toast({
        title: "Descarga completada",
        description: "Todos los soportes han sido descargados.",
      });
  }, [soportes, downloadFile, toast]);

  if (!soportes || soportes.length === 0) {
    return null;
  }

  const currentSoporte = soportes[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex === 0 ? soportes.length - 1 : prevIndex - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex === soportes.length - 1 ? 0 : prevIndex + 1));
  };

  const handlePrint = () => {
    const printWindow = window.open(currentSoporte, '_blank');
    printWindow.onload = function() {
        printWindow.focus();
        printWindow.print();
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Visor de Soportes</DialogTitle>
          <DialogDescription>
            Documento: {orden.prefijo_documento}-{orden.numero_documento}. Soporte {currentIndex + 1} de {soportes.length}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow flex items-center justify-center bg-gray-100 rounded-md overflow-hidden relative">
          {isImage(currentSoporte) ? (
            <img src={currentSoporte} alt={`Soporte ${currentIndex + 1}`} className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center p-8 flex flex-col items-center gap-4">
               <FileText className="w-16 h-16 text-gray-400" />
              <p className="mb-4">No se puede previsualizar este tipo de archivo.</p>
              <Button onClick={() => downloadFile(currentSoporte)}>
                <Download className="mr-2 h-4 w-4" /> Descargar Archivo
              </Button>
            </div>
          )}
           {soportes.length > 1 && (
            <>
              <Button onClick={goToPrevious} variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white">
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button onClick={goToNext} variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white">
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
        <div className="flex justify-between items-center gap-2 pt-4 border-t">
          {soportes.length > 1 ? (
             <Button variant="outline" onClick={handleDownloadAll} disabled={isDownloading}>
                {isDownloading ? <><DownloadCloud className="mr-2 h-4 w-4 animate-bounce" /> Descargando...</> : <><Download className="mr-2 h-4 w-4" /> Descargar Todos</>}
              </Button>
          ) : <div/>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => downloadFile(currentSoporte)}>
                <Download className="mr-2 h-4 w-4" /> Descargar Actual
            </Button>
            <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimir
            </Button>
            <Button onClick={() => onOpenChange(false)}>
                Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}