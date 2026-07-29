'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { formatCop } from '@/lib/money'
import type { SupplierBalance, Supplier } from '@/modules/suppliers/types'
import type { StockLevel } from '@/modules/inventory/types'
import {
  createPurchaseAction,
  createSupplierAction,
  registerSupplierPaymentAction,
  type SupplierActionState,
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

const initial: SupplierActionState = { error: null, message: null }

const today = () => new Date().toISOString().slice(0, 10)

export function SuppliersPanel({
  suppliers,
  balances,
  items,
}: {
  suppliers: Supplier[]
  balances: SupplierBalance[]
  items: StockLevel[]
}) {
  const owed = balances.filter((b) => b.balanceCop > 0)
  const totalOwed = owed.reduce((sum, b) => sum + b.balanceCop, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <PurchaseDialog suppliers={suppliers} items={items} />
          <PaymentDialog suppliers={suppliers} />
          <NewSupplierDialog />
        </div>
        {totalOwed > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Por pagar: </span>
            <span className="font-semibold tabular-nums">
              {formatCop(totalOwed)}
            </span>
            <span className="text-muted-foreground">
              {' '}
              a {owed.length} proveedor{owed.length === 1 ? '' : 'es'}
            </span>
          </p>
        )}
      </div>

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Proveedor</TableHead>
              <TableHead className="text-right">Comprado</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
              <TableHead>Última compra</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {balances.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">
                  {b.name}
                  {!b.active && (
                    <Badge variant="secondary" className="ml-2">
                      Inactivo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCop(b.purchasedCop)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {formatCop(b.paidCop)}
                </TableCell>
                <TableCell
                  className={`text-right font-semibold tabular-nums ${
                    b.balanceCop > 0 ? 'text-amber-600' : ''
                  }`}
                >
                  {formatCop(b.balanceCop)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {b.lastPurchaseOn ?? '—'}
                </TableCell>
              </TableRow>
            ))}

            {balances.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-muted-foreground"
                >
                  Todavía no hay proveedores. Registra uno y sus compras
                  empiezan a sumar al inventario y a su saldo.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Compra: cabecera con proveedor y fecha, y una línea por ítem. */
function PurchaseDialog({
  suppliers,
  items,
}: {
  suppliers: Supplier[]
  items: StockLevel[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createPurchaseAction(initial, formData)
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.message) toast.success(result.message)
      setOpen(false)
    })
  }

  const disabled = suppliers.length === 0 || items.length === 0

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button disabled={disabled} />}>
        Registrar compra
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Compra a proveedor</DialogTitle>
            <DialogDescription>
              Lo que registres aquí entra al inventario y suma al saldo del
              proveedor. Son el mismo hecho.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pur-supplier">Proveedor</Label>
              <select
                id="pur-supplier"
                name="supplierId"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pur-date">Fecha</Label>
              <Input
                id="pur-date"
                name="purchaseDate"
                type="date"
                defaultValue={today()}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pur-invoice">Factura</Label>
              <Input id="pur-invoice" name="invoiceNumber" placeholder="Opcional" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pur-note">Nota</Label>
              <Input id="pur-note" name="note" placeholder="Opcional" />
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ítem</TableHead>
                  <TableHead className="w-28 text-center">Cantidad</TableHead>
                  <TableHead className="w-36 text-center">
                    Costo unitario
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <input type="hidden" name="itemId" value={item.id} />
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.unit}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Input
                        name="quantity"
                        type="number"
                        step="0.25"
                        min="0"
                        placeholder="—"
                        className="no-spinner h-8 text-center"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        name="unitCost"
                        type="number"
                        step="1"
                        min="0"
                        placeholder="$"
                        className="no-spinner h-8 text-center"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar compra'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PaymentDialog({ suppliers }: { suppliers: Supplier[] }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await registerSupplierPaymentAction(initial, formData)
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
      <DialogTrigger
        render={<Button variant="outline" disabled={suppliers.length === 0} />}
      >
        Registrar pago
      </DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Pago a proveedor</DialogTitle>
            <DialogDescription>
              Baja el saldo. No toca el inventario.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="pay-supplier">Proveedor</Label>
            <select
              id="pay-supplier"
              name="supplierId"
              required
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto</Label>
              <Input
                id="pay-amount"
                name="amountCop"
                type="number"
                min="1"
                step="1"
                required
                className="no-spinner"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-date">Fecha</Label>
              <Input
                id="pay-date"
                name="paidOn"
                type="date"
                defaultValue={today()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-method">Medio</Label>
              <select
                id="pay-method"
                name="method"
                defaultValue="transferencia"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="transferencia">Transferencia</option>
                <option value="efectivo">Efectivo</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-note">Nota</Label>
            <Input id="pay-note" name="note" placeholder="Opcional" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Registrando…' : 'Registrar pago'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function NewSupplierDialog() {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createSupplierAction(initial, formData)
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
        Nuevo proveedor
      </DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nuevo proveedor</DialogTitle>
            <DialogDescription>
              A quién se le compran cartones, frascos o fruta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="sup-name">Nombre</Label>
            <Input id="sup-name" name="name" required autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sup-nit">NIT</Label>
              <Input id="sup-nit" name="nit" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sup-phone">Teléfono</Label>
              <Input id="sup-phone" name="phone" inputMode="tel" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-contact">Contacto</Label>
            <Input id="sup-contact" name="contact" placeholder="Con quién se habla" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sup-notes">Notas</Label>
            <Input id="sup-notes" name="notes" />
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
