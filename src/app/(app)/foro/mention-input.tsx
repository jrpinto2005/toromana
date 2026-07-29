'use client'

import { useMemo, useRef, useState } from 'react'
import {
  handleFor,
  mentionAtCaret,
  type MentionablePerson,
} from '@/modules/forum/mentions'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

/** Sin tildes y en minúsculas, para filtrar como se escribe de verdad. */
function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Campo de texto que sugiere a quién nombrar cuando se escribe `@`.
 *
 * El texto sigue siendo texto plano: el menú solo ahorra escribirlo bien. Eso
 * importa porque la mención se resuelve leyendo el cuerpo del mensaje, así que
 * lo que se guarda es legible aunque nadie la haya elegido del menú, y una
 * mención escrita a mano funciona igual.
 *
 * Lo que el menú sí garantiza es que el texto insertado sea uno que el
 * buscador reconoce — de ahí que el handle lo decida `handleFor` y no esta
 * pantalla.
 */
export function MentionInput({
  name,
  people,
  multiline = false,
  className,
  onValueChange,
  ...props
}: {
  name: string
  people: MentionablePerson[]
  multiline?: boolean
  className?: string
  /** Para que la pantalla pueda mostrar a quién se va a avisar. */
  onValueChange?: (value: string) => void
} & Omit<React.ComponentProps<'textarea'>, 'name' | 'className' | 'ref'>) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [mention, setMention] = useState<{ query: string; start: number } | null>(
    null,
  )
  const [highlighted, setHighlighted] = useState(0)

  const matches = useMemo(() => {
    if (!mention) return []
    const q = fold(mention.query)
    return people
      .filter((p) => !q || fold(p.fullName).includes(q))
      .slice(0, 6)
  }, [people, mention])

  const open = matches.length > 0

  function sync(el: HTMLTextAreaElement | HTMLInputElement) {
    const found = mentionAtCaret(el.value, el.selectionStart ?? 0)
    setMention(found)
    setHighlighted(0)
  }

  function insert(person: MentionablePerson) {
    const el = ref.current
    if (!el || !mention) return

    const caret = el.selectionStart ?? 0
    const handle = handleFor(person, people)
    // El espacio final cierra la mención y deja el cursor listo para seguir
    // escribiendo, que es lo que uno hace después de nombrar a alguien.
    const inserted = `@${handle} `
    const next = value.slice(0, mention.start) + inserted + value.slice(caret)

    setValue(next)
    onValueChange?.(next)
    setMention(null)

    const position = mention.start + inserted.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(position, position)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (!open) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => (i + 1) % matches.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => (i - 1 + matches.length) % matches.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      // Con el menú abierto, Enter escoge; si no, publicaría el mensaje a
      // medio escribir justo cuando uno está nombrando a alguien.
      e.preventDefault()
      insert(matches[highlighted])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setMention(null)
    }
  }

  const shared = {
    ref,
    name,
    value,
    onChange: (
      e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
    ) => {
      setValue(e.target.value)
      onValueChange?.(e.target.value)
      sync(e.target)
    },
    // El cursor también se mueve con clics y flechas: si no se recalcula, el
    // menú queda abierto sobre una mención que ya no está bajo el cursor.
    onKeyUp: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      sync(e.currentTarget),
    onClick: (e: React.MouseEvent<HTMLTextAreaElement | HTMLInputElement>) =>
      sync(e.currentTarget),
    onKeyDown,
    // En blur cierra, pero con retardo: sin él, el blur del clic desmonta el
    // botón antes de que su onClick llegue a dispararse.
    onBlur: () => setTimeout(() => setMention(null), 150),
    autoComplete: 'off',
  }

  return (
    <div className="relative">
      {multiline ? (
        <Textarea {...props} {...shared} className={className} />
      ) : (
        <Input
          {...(props as React.ComponentProps<'input'>)}
          {...shared}
          className={className}
        />
      )}

      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 w-64 overflow-hidden rounded-md border bg-background shadow-md"
        >
          {matches.map((person, index) => (
            <button
              key={person.id}
              type="button"
              role="option"
              aria-selected={index === highlighted}
              onMouseEnter={() => setHighlighted(index)}
              onClick={() => insert(person)}
              className={cn(
                'block w-full px-3 py-2 text-left text-sm',
                index === highlighted ? 'bg-muted' : 'hover:bg-muted',
              )}
            >
              <span className="font-medium">{person.fullName}</span>
              <span className="ml-2 text-xs text-muted-foreground">
                @{handleFor(person, people)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
