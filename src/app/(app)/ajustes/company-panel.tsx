"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateCompanySettings } from "./actions";

type Company = {
  legalName: string;
  taxId: string;
  brandName: string;
  contactBlock: string;
  bankDetails: string;
  bankDetailsInstitutional: string;
};

export function CompanyPanel({ company }: { company: Company }) {
  const [form, setForm] = useState(company);
  const [pending, startTransition] = useTransition();

  function field<K extends keyof Company>(key: K) {
    return {
      value: form[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: event.target.value })),
    };
  }

  function save() {
    startTransition(async () => {
      const result = await updateCompanySettings(form);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Configuración de la empresa actualizada.");
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos de la empresa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Aparecen en recibos y en los mensajes de cobro. Nunca hardcodeados en el código
          — el repositorio es público.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brand-name">Nombre comercial</Label>
            <Input id="brand-name" {...field("brandName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="legal-name">Razón social</Label>
            <Input id="legal-name" {...field("legalName")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tax-id">NIT</Label>
            <Input id="tax-id" {...field("taxId")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="contact-block">Contacto (teléfonos, correo)</Label>
          <Textarea id="contact-block" rows={2} {...field("contactBlock")} />
        </div>

        {/* Dos cuentas, porque el cobro no es el mismo. Un hotel gira contra
            factura a la cuenta de la empresa; una clienta transfiere a la
            cuenta simple. Mandar la equivocada termina en un pago mal aplicado
            y una llamada de contabilidad. El mensaje de WhatsApp escoge la que
            corresponde según el tipo de cliente. */}
        <div className="space-y-1.5">
          <Label htmlFor="bank-details">Cuenta para clientes personas</Label>
          <Textarea
            id="bank-details"
            rows={2}
            {...field("bankDetails")}
            placeholder="Banco, tipo de cuenta, número — va en el cobro por WhatsApp"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bank-details-inst">Cuenta para institucionales</Label>
          <Textarea
            id="bank-details-inst"
            rows={2}
            {...field("bankDetailsInstitutional")}
            placeholder="La cuenta de la empresa, con razón social y NIT"
          />
          <p className="text-xs text-muted-foreground">
            Si se deja vacía se usa la de personas.
          </p>
        </div>

        <Button onClick={save} disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </CardContent>
    </Card>
  );
}
