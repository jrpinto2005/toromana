'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brand } from '@/components/brand'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#faf2e1] p-4 dark:bg-[#12120f]">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm"
      >
        <div className="space-y-2">
          <Brand size="lg" />
          <p className="text-sm text-muted-foreground">
            Pedidos, reparto y cartera del galpón. Entra con tu usuario o tu
            correo.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">Usuario o correo</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
        </div>

        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </main>
  )
}
