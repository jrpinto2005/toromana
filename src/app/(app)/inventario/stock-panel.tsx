'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatQuantity } from '@/lib/money'
import type { StockLevel } from '@/modules/inventory/types'
import {
  createItemAction,
  recordMovementAction,
  setReorderPointAction,
  type InventoryActionState,
} from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const initial: InventoryActionState = { error: null, message: null }

const MOVEMENT_REASONS = [
  { value: 'compra', label: 'Compra — entra' },
  { value: 'inicial', label: 'Saldo inicial — entra' },
  { value: 'ajuste', label: 'Ajuste — entra' },
  { value: 'merma', label: 'Merma — sale' },
]

export function StockPanel({ items }: { items: StockLevel[] }) {
  const low = items.filter((i) => i.belowReorder)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <MovementDialog items={items} />
          <NewItemDialog />
        </div>
        {low.length > 0 && (
          <p className="text-sm text-amber-700 dark:text-amber-500">
            {low.length} ítem{low.length === 1 ? '' : 's'} en el punto de
            reposición o por debajo.
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ítem</TableHead>
              <TableHead className="text-right">Existencia</TableHead>
              <TableHead className="w-44">Avisar cuando baje de</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>
                  <div className="font-medium">{item.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.unit}
                    {item.kind === 'insumo' && ' · insumo'}
                  </div>
                </TableCell>

                <TableCell
                  className={cn(
                    'text-right text-base font-semibold tabular-nums',
                    item.stock < 0 && 'text-destructive',
                    item.belowReorder && item.stock >= 0 && 'text-amber-600',
                  )}
                >
                  {formatQuantity(item.stock)}
                </TableCell>

                <TableCell>
                  <form action={setReorderPointAction} className="flex gap-2">
                    <input type="hidden" name="itemId" value={item.id} />
                    <Input
                      name="reorderPoint"
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={item.reorderPoint}
                      onBlur={(e) => {
                        if (Number(e.currentTarget.value) === item.reorderPoint) return
                        e.currentTarget.form?.requestSubmit()
                      }}
                      className="no-spinner h-8 w-24"
                    />
                  </form>
                </TableCell>

                <TableCell className="text-right">
                  {item.belowReorder ? (
                    <Badge variant="secondary" className="whitespace-nowrap">
                      Reponer
                    </Badge>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}

            {items.length === 0 && (
              <TableCell
                colSpan={4}
                className="py-10 text-center text-muted-foreground"
              >
                Todavía no hay nada que contar. Agrega miel, mermelada o
                cartones y el stock empieza a moverse solo con los pedidos.
              </TableCell>
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        La existencia no se edita a mano: sale de sumar los movimientos. Para
        corregirla se registra una entrada o una merma, y así queda el rastro
        de quién y por qué.
      </p>
    </div>
  )
}

function MovementDialog({ items }: { items: StockLevel[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await recordMovementAction(initial, formData)
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
      <DialogTrigger render={<Button />}>Registrar movimiento</DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Movimiento de inventario</DialogTitle>
            <DialogDescription>
              El signo lo pone el motivo: la merma resta, lo demás suma.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="mov-item">Ítem</Label>
            <select
              id="mov-item"
              name="itemId"
              required
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({formatQuantity(i.stock)} {i.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="mov-reason">Motivo</Label>
              <select
                id="mov-reason"
                name="reason"
                defaultValue="compra"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {MOVEMENT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mov-qty">Cantidad</Label>
              <Input
                id="mov-qty"
                name="quantity"
                type="number"
                step="0.25"
                min="0.25"
                required
                className="no-spinner"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mov-note">Nota</Label>
            <Input id="mov-note" name="note" placeholder="Opcional" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewItemDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createItemAction(initial, formData)
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
        Nuevo ítem
      </DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo ítem de inventario</DialogTitle>
            <DialogDescription>
              Un producto se vende y se cuenta; un insumo solo se consume, como
              los cartones.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="item-name">Nombre</Label>
            <Input id="item-name" name="name" required autoFocus />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-unit">Unidad</Label>
              <Input id="item-unit" name="unit" placeholder="frasco" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-kind">Tipo</Label>
              <select
                id="item-kind"
                name="kind"
                defaultValue="producto"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="producto">Producto</option>
                <option value="insumo">Insumo</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-reorder">Avisar bajo</Label>
              <Input
                id="item-reorder"
                name="reorderPoint"
                type="number"
                min="0"
                defaultValue={0}
                className="no-spinner"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
