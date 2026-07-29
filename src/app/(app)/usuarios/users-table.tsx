'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  createUserAction,
  resetPasswordAction,
  updatePermissionsAction,
  type PermissionState,
  type ResetState,
} from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
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

export type TeamMember = {
  id: string
  fullName: string
  role: string
  roleLabel: string
  isSeller: boolean
  identity: string
}

const initialState: ResetState = { error: null, password: null, userName: null }
const initialPermissions: PermissionState = { error: null, message: null }

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administración', hint: 'Todo, incluidas las cuentas' },
  { value: 'contabilidad', label: 'Contabilidad', hint: 'Cartera y proveedores' },
  { value: 'produccion', label: 'Producción', hint: 'Lotes e inventario' },
  { value: 'reparto', label: 'Reparto', hint: 'Solo la ruta del día' },
]

export function UsersTable({ members }: { members: TeamMember[] }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  )
  const [created, createAction, creating] = useActionState(
    createUserAction,
    initialState,
  )

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  useEffect(() => {
    if (created.error) toast.error(created.error)
  }, [created])

  // La clave recién generada, venga de un alta o de un restablecimiento.
  const secret = created.password ? created : state

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <NewUserDialog action={createAction} pending={creating} done={created} />
      </div>

      {secret.password && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            Contraseña de {secret.userName}
          </p>
          <p className="my-2 font-mono text-2xl tracking-wider">
            {secret.password}
          </p>
          <p className="text-sm text-muted-foreground">
            Cópiala ahora: no se guarda en ninguna parte y no se puede volver a
            ver. Si se pierde, se genera otra.
          </p>
        </div>
      )}

      <div className="rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Entra como</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.fullName}</TableCell>
                <TableCell className="font-mono text-sm text-muted-foreground">
                  {m.identity || '—'}
                </TableCell>
                <TableCell>
                  {m.roleLabel}
                  {m.isSeller && (
                    <Badge variant="secondary" className="ml-2">
                      Vende
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    <PermissionsDialog member={m} />
                    <form action={formAction} className="inline">
                      <input type="hidden" name="userId" value={m.id} />
                      <input type="hidden" name="userName" value={m.fullName} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                      >
                        Restablecer
                      </Button>
                    </form>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

function RoleChoice({
  id,
  defaultValue,
}: {
  id: string
  defaultValue: string
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Rol</Label>
      <select
        id={id}
        name="role"
        defaultValue={defaultValue}
        className="h-9 w-full rounded-md border bg-background px-3 text-sm"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label} — {r.hint}
          </option>
        ))}
      </select>
    </div>
  )
}

function NewUserDialog({
  action,
  pending,
  done,
}: {
  action: (formData: FormData) => void
  pending: boolean
  done: ResetState
}) {
  const [open, setOpen] = useState(false)

  // Se cierra cuando el alta produjo una contraseña: es la señal de que salió
  // bien, y la clave queda visible en el aviso de la pantalla de atrás.
  useEffect(() => {
    if (done.password) setOpen(false)
  }, [done.password])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>Nueva cuenta</DialogTrigger>
      <DialogContent>
        <form action={action} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Nueva cuenta</DialogTitle>
            <DialogDescription>
              La contraseña se genera sola y se muestra una sola vez.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor="new-fullName">Nombre</Label>
            <Input id="new-fullName" name="fullName" required autoFocus />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-identity">Correo o usuario</Label>
            <Input id="new-identity" name="identity" required />
            <p className="text-xs text-muted-foreground">
              Sin arroba se toma como usuario suelto y no recibe correo. Con
              correo real le llegan los avisos del foro y del inventario.
            </p>
          </div>

          <RoleChoice id="new-role" defaultValue="reparto" />

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isSeller" />
            Vende: aparece en la lista de vendedores de los clientes
          </label>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando…' : 'Crear cuenta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PermissionsDialog({ member }: { member: TeamMember }) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updatePermissionsAction(initialPermissions, formData)
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
      <DialogTrigger render={<Button variant="ghost" size="sm" />}>
        Permisos
      </DialogTrigger>
      <DialogContent>
        <form action={submit} className="space-y-4">
          <input type="hidden" name="userId" value={member.id} />

          <DialogHeader>
            <DialogTitle>{member.fullName}</DialogTitle>
            <DialogDescription>
              El rol decide qué pestañas ve y qué puede escribir.
            </DialogDescription>
          </DialogHeader>

          <RoleChoice id={`role-${member.id}`} defaultValue={member.role} />

          <label className="flex items-center gap-2 text-sm">
            <Checkbox name="isSeller" defaultChecked={member.isSeller} />
            Vende: aparece en la lista de vendedores de los clientes
          </label>

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
