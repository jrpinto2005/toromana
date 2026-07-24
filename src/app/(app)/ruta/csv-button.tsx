"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routeToCsv, type RouteStop } from "@/modules/documents/client";

export function CsvButton({ stops, deliveryDate }: { stops: RouteStop[]; deliveryDate: string }) {
  function download() {
    const csv = routeToCsv(stops);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ruta-${deliveryDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download />
      Descargar CSV
    </Button>
  );
}
