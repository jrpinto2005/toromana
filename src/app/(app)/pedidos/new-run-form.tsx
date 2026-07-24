'use client'

import { useActionState, useEffect } from 'react'
import { toast } from 'sonner'
import { createRunAction, type RunActionState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const initialState: RunActionState = { error: null, message: null }

export function NewRunForm({ defaultDate }: { defaultDate: string }) {
  const [state, formAction, pending] = useActionState(
    createRunAction,
    initialState,
  )

  useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <form
      action={formAction}
      className="flex items-end gap-3 rounded-lg border bg-background p-3"
    >
      <div className="space-y-1.5">
        <Label htmlFor="deliveryDate" className="text-xs">
          Fecha de entrega
        </Label>
        <Input
          id="deliveryDate"
          name="deliveryDate"
          type="date"
          defaultValue={defaultDate}
          required
          className="w-44"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? 'Generando…' : 'Crear pedido'}
      </Button>
    </form>
  )
}
