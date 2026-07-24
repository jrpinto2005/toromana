'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { resetPasswordAction, type ResetState } from './actions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

export function UsersTable({ members }: { members: TeamMember[] }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    initialState,
  )

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <div className="space-y-4">
      {state.password && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40">
          <p className="text-sm font-medium">
            Contraseña nueva de {state.userName}
          </p>
          <p className="my-2 font-mono text-2xl tracking-wider">
            {state.password}
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
              <TableHead className="text-right">Contraseña</TableHead>
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
                <TableCell className="text-right">
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
