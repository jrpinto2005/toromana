'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { Seller } from '@/modules/clients'
import { createCustomerAction, type ActionState } from './actions'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const initialState: ActionState = { error: null, message: null }

export function NewCustomerDialog({ sellers }: { sellers: Seller[] }) {
  const [open, setOpen] = useState(false)
  // El resultado se atiende dentro de la transición, no en un efecto: cerrar
  // el diálogo desde un `useEffect` provoca renders en cascada y React 19 lo
  // marca como error. Aquí el `setState` ocurre en el manejador, que es su sitio.
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createCustomerAction(initialState, formData)
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
      <DialogTrigger render={<Button />}>Nuevo cliente</DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo cliente</DialogTitle>
            <DialogDescription>
              Los ocasionales se agregan al pedido de la semana a mano; los
              semanales entran solos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" name="name" required autoFocus />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input id="address" name="address" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input id="phone" name="phone" inputMode="tel" />
              <p className="text-xs text-muted-foreground">
                Sin él no hay cobro por WhatsApp.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sellerId">Vendedor</Label>
              <Select name="sellerId" defaultValue="none">
                <SelectTrigger id="sellerId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {sellers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="kind">Tipo</Label>
              <Select name="kind" defaultValue="natural">
                <SelectTrigger id="kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="natural">Natural</SelectItem>
                  <SelectItem value="institucional">Institucional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="recurrence">Frecuencia</Label>
              <Select name="recurrence" defaultValue="ocasional">
                <SelectTrigger id="recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="ocasional">Ocasional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
