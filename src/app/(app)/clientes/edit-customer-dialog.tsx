'use client'

import { useActionState, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Customer } from '@/modules/clients/types'
import type { Seller } from '@/modules/clients'
import { updateCustomerAction, type ActionState } from './actions'
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

const initialState: ActionState = { error: null, message: null }

function Field({
  id,
  label,
  hint,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} {...props} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function Choice({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string
  name: string
  label: string
  value: string
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select
        id={id}
        name={name}
        defaultValue={value}
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

export function EditCustomerDialog({
  customer,
  sellers,
}: {
  customer: Customer
  sellers: Seller[]
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    updateCustomerAction,
    initialState,
  )

  useEffect(() => {
    if (state.message) {
      toast.success(state.message)
      setOpen(false)
    }
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Editar
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="customerId" value={customer.id} />

          <DialogHeader>
            <DialogTitle>{customer.name}</DialogTitle>
            <DialogDescription>
              La frecuencia decide si entra solo al pedido semanal. El teléfono
              habilita el cobro por WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <Field id="name" name="name" label="Nombre" defaultValue={customer.name} required />
          <Field
            id="address"
            name="address"
            label="Dirección"
            defaultValue={customer.address ?? ''}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              id="phone"
              name="phone"
              label="Teléfono"
              inputMode="tel"
              defaultValue={customer.phone ?? ''}
              hint="Con indicativo o sin él; se normaliza solo."
            />
            <Choice
              id="sellerId"
              name="sellerId"
              label="Vendedor"
              value={customer.sellerId ?? 'none'}
              options={[
                { value: 'none', label: 'Sin asignar' },
                ...sellers.map((s) => ({ value: s.id, label: s.fullName })),
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Choice
              id="recurrence"
              name="recurrence"
              label="Frecuencia"
              value={customer.recurrence}
              options={[
                { value: 'semanal', label: 'Semanal' },
                { value: 'quincenal', label: 'Quincenal' },
                { value: 'ocasional', label: 'Ocasional' },
              ]}
            />
            <Choice
              id="kind"
              name="kind"
              label="Tipo"
              value={customer.kind}
              options={[
                { value: 'natural', label: 'Natural' },
                { value: 'institucional', label: 'Institucional' },
              ]}
            />
          </div>

          <details className="rounded-md border p-3" open={customer.kind === 'institucional'}>
            <summary className="cursor-pointer text-sm font-medium">
              Datos para la orden de compra
            </summary>
            <div className="mt-3 space-y-3">
              <Field
                id="legalName"
                name="legalName"
                label="Razón social"
                defaultValue={customer.legalName ?? ''}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field id="nit" name="nit" label="NIT" defaultValue={customer.nit ?? ''} />
                <Choice
                  id="poSequence"
                  name="poSequence"
                  label="Consecutivo"
                  value={customer.poSequence ?? 'general'}
                  options={[
                    { value: 'general', label: 'General' },
                    { value: 'institucional_b', label: 'Secundario' },
                  ]}
                />
              </div>
              <Field
                id="poNote"
                name="poNote"
                label="Nota al pie del producto"
                defaultValue={customer.poNote ?? ''}
                hint="Por ejemplo, la cláusula de comodato de las cubetas."
              />
            </div>
          </details>

          <Field
            id="notes"
            name="notes"
            label="Notas internas"
            defaultValue={customer.notes ?? ''}
          />

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
