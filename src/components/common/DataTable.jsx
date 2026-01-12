
import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';

export default function DataTable({ headers, data, renderRow, keyField = "id", loading }) {
  const [page, setPage] = useState(1);
  const rowsPerPage = 10;
  const totalPages = Math.ceil(data.length / rowsPerPage);
  const paginatedData = data.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const startRecord = data.length > 0 ? (page - 1) * rowsPerPage + 1 : 0;
  const endRecord = Math.min(page * rowsPerPage, data.length);

  return (
    <>
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center h-24 text-slate-500">
                  <div className="flex justify-center items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Cargando datos...
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedData.length > 0 ? (
              paginatedData.map((row) => renderRow(row))
            ) : (
              <TableRow>
                <TableCell colSpan={headers.length} className="text-center h-24 text-slate-500">
                  No hay registros para mostrar.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-sm text-slate-600">
          {data.length > 0 ? `Mostrando registros del ${startRecord} al ${endRecord} de ${data.length}` : 'No hay registros'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium">{page} / {totalPages > 0 ? totalPages : 1}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page === totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </>
  );
}
