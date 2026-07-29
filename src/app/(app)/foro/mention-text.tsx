'use client'

import { splitMentions, type MentionablePerson } from '@/modules/forum/mentions'

/**
 * Cuerpo de un mensaje con las menciones resaltadas.
 *
 * Solo se pinta lo que corresponde a alguien del equipo. Un `@juanito` que
 * queda en gris es la señal de que a nadie le llegó ese aviso —y esa es
 * justamente la información que hoy falta cuando una mención no cae.
 */
export function MentionText({
  body,
  people,
  className,
}: {
  body: string
  people: MentionablePerson[]
  className?: string
}) {
  const segments = splitMentions(body, people)

  return (
    <p className={className}>
      {segments.map((segment, index) =>
        segment.person ? (
          <strong
            key={index}
            title={segment.person.fullName}
            className="rounded bg-primary/10 px-1 font-medium text-primary"
          >
            {segment.text}
          </strong>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </p>
  )
}
