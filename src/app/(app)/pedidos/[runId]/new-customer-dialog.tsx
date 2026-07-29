'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Seller } from '@/modules/clients/types'
import { createAndAddCustomerAction, type RunActionState } from '../actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

const initial: RunActionState = { error: null, message: null }

/** Desplegable nativo: no arrastra el bug de etiquetas del Select de Base UI. */
function Choice({
  id,
  name,
  label,
  defaultValue,
  options,
}: {
  id: string
  name: string
  label: string
  defaultValue: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/**
 * Cliente nuevo sin salir del pedido.
 *
 * Nace ocasional a propósito: se está creando para la entrega de esta semana.
 * Si además resulta ser fijo, se marca en Clientes y entra solo desde el
 * próximo pedido — pero eso es una decisión aparte, y no debe frenar la que
 * está ocurriendo ahora, que es despachar a alguien que acaba de encargar.
 */
export function NewCustomerDialog({
  runId,
  sellers,
  currentSellerId,
}: {
  runId: string
  sellers: Seller[]
  currentSellerId: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createAndAddCustomerAction(initial, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.message) toast.success(result.message)
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        Cliente nuevo
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <form action={submit} className="space-y-4">
          <input type="hidden" name="runId" value={runId} />

          <DialogHeader>
            <DialogTitle>Cliente nuevo</DialogTitle>
            <DialogDescription>
              Queda creado en la base y agregado a este pedido de una vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-name">Nombre</Label>
            <Input id="new-name" name="name" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-address">Dirección</Label>
            <Input id="new-address" name="address" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="new-phone">Teléfono</Label>
              <Input id="new-phone" name="phone" inputMode="tel" />
              <p className="text-xs text-muted-foreground">
                Sin él no hay cobro por WhatsApp.
              </p>
            </div>
            <Choice
              id="new-sellerId"
              name="sellerId"
              label="Vendedor"
              defaultValue={currentSellerId ?? 'none'}
              options={[
                { value: 'none', label: 'Sin asignar' },
                ...sellers.map((s) => ({ value: s.id, label: s.fullName })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Choice
              id="new-kind"
              name="kind"
              label="Tipo"
              defaultValue="natural"
              options={[
                { value: 'natural', label: 'Natural' },
                { value: 'institucional', label: 'Institucional' },
              ]}
            />
            <Choice
              id="new-recurrence"
              name="recurrence"
              label="Frecuencia"
              defaultValue="ocasional"
              options={[
                { value: 'ocasional', label: 'Ocasional' },
                { value: 'semanal', label: 'Semanal' },
                { value: 'quincenal', label: 'Quincenal' },
              ]}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear y agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
