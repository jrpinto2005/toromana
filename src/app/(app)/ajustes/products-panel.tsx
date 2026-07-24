"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCop, parseCop } from "@/lib/money";
import { updateProductPrice } from "./actions";

type Product = { id: string; name: string; unit: string; listPriceCop: number };

export function ProductsPanel({ products }: { products: Product[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Precios de lista</CardTitle>
        <p className="text-sm text-muted-foreground">
          Solo cambia lo que se cobra de aquí en adelante. Los pedidos ya confirmados
          conservan el precio con el que se congelaron.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {products.map((product) => (
          <ProductRow key={product.id} product={product} />
        ))}
      </CardContent>
    </Card>
  );
}

function ProductRow({ product }: { product: Product }) {
  const [value, setValue] = useState(String(product.listPriceCop));
  const [pending, startTransition] = useTransition();

  const parsed = parseCop(value);
  const dirty = parsed !== null && parsed !== product.listPriceCop;

  function save() {
    if (parsed === null) {
      toast.error("Escribe un precio válido.");
      return;
    }
    startTransition(async () => {
      const result = await updateProductPrice(product.id, parsed);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${product.name}: ${formatCop(parsed)}`);
    });
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
      <div className="flex-1">
        <p className="font-medium">{product.name}</p>
        <p className="text-xs text-muted-foreground">{product.unit}</p>
      </div>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="numeric"
        className="w-32"
      />
      <Button size="sm" disabled={!dirty || pending} onClick={save}>
        Guardar
      </Button>
    </div>
  );
}
