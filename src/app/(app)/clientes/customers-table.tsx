'use client'

import { useActionState, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { Customer, Seller } from '@/modules/clients'
import { assignSellerAction, type ActionState } from './actions'
import { EditCustomerDialog } from './edit-customer-dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const initialState: ActionState = { error: null, message: null }

const RECURRENCE_LABEL: Record<string, string> = {
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  ocasional: 'Ocasional',
}

export function CustomersTable({
  customers,
  sellers,
}: {
  customers: Customer[]
  sellers: Seller[]
}) {
  const [search, setSearch] = useState('')
  const [onlyUnassigned, setOnlyUnassigned] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [state, formAction, pending] = useActionState(
    assignSellerAction,
    initialState,
  )

  useEffect(() => {
    if (state.message) {
      toast.success(state.message)
      setSelected(new Set())
    }
    if (state.error) toast.error(state.error)
  }, [state])

  const sellerName = useMemo(
    () => new Map(sellers.map((s) => [s.id, s.fullName])),
    [sellers],
  )

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      if (onlyUnassigned && c.sellerId) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.address ?? '').toLowerCase().includes(q)
      )
    })
  }, [customers, search, onlyUnassigned])

  const unassignedCount = customers.filter((c) => !c.sellerId).length
  const allVisibleSelected =
    visible.length > 0 && visible.every((c) => selected.has(c.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((c) => next.delete(c.id))
      else visible.forEach((c) => next.add(c.id))
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Buscar por nombre o dirección…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button
          type="button"
          variant={onlyUnassigned ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyUnassigned((v) => !v)}
        >
          Sin vendedor ({unassignedCount})
        </Button>
        <span className="text-sm text-muted-foreground">
          {visible.length} de {customers.length}
        </span>
      </div>

      {selected.size > 0 && (
        <form
          action={formAction}
          className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3"
        >
          {[...selected].map((id) => (
            <input key={id} type="hidden" name="customerId" value={id} />
          ))}
          <span className="text-sm font-medium">
            {selected.size} seleccionado(s) — asignar a:
          </span>
          {sellers.map((s) => (
            <Button
              key={s.id}
              type="submit"
              name="sellerId"
              value={s.id}
              size="sm"
              disabled={pending}
            >
              {s.fullName}
            </Button>
          ))}
          <Button
            type="submit"
            name="sellerId"
            value="none"
            size="sm"
            variant="outline"
            disabled={pending}
          >
            Quitar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            Cancelar
          </Button>
        </form>
      )}

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allVisibleSelected}
                  onCheckedChange={toggleAllVisible}
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Frecuencia</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((c) => (
              <TableRow key={c.id} data-state={selected.has(c.id) && 'selected'}>
                <TableCell>
                  <Checkbox
                    checked={selected.has(c.id)}
                    onCheckedChange={() => toggle(c.id)}
                    aria-label={`Seleccionar ${c.name}`}
                  />
                </TableCell>
                <TableCell className="font-medium">
                  {c.name}
                  {c.kind === 'institucional' && (
                    <Badge variant="secondary" className="ml-2">
                      Institucional
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.address ?? '—'}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {c.phone ?? (
                    <span className="text-amber-600">Sin teléfono</span>
                  )}
                </TableCell>
                <TableCell>
                  {c.sellerId ? (
                    sellerName.get(c.sellerId) ?? '—'
                  ) : (
                    <span className="text-amber-600">Sin asignar</span>
                  )}
                </TableCell>
                <TableCell>{RECURRENCE_LABEL[c.recurrence]}</TableCell>
                <TableCell className="text-right">
                  <EditCustomerDialog customer={c} sellers={sellers} />
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                  Ningún cliente coincide con la búsqueda.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
