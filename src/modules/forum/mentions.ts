/**
 * Menciones del foro.
 *
 * Puro a propósito: no lee la base ni manda nada. Recibe el texto y la lista
 * de personas, y devuelve a quién se nombró. Quien avisa es la acción que lo
 * llama — así esto se puede probar sin levantar nada.
 */

export type MentionablePerson = { id: string; fullName: string }

/** Sin tildes y en minúsculas: nadie escribe "@Mónica" con la tilde. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Los identificadores por los que responde una persona.
 *
 * El nombre completo pegado (`@anamaria`) y el primer nombre (`@ana`). El
 * primer nombre es el que la gente escribe de verdad; el completo existe para
 * cuando hay dos Anas y hay que desambiguar.
 */
function handlesFor(person: MentionablePerson): string[] {
  const clean = normalize(person.fullName).trim()
  if (!clean) return []

  const parts = clean.split(/\s+/)
  const handles = new Set<string>()
  handles.add(parts.join(''))
  if (parts[0]) handles.add(parts[0])
  return [...handles]
}

/**
 * El texto que hay que insertar para nombrar a alguien.
 *
 * Devuelve el primer nombre si nadie más del equipo lo comparte, y el nombre
 * completo pegado si hay dos Anas. Vive junto a `findMentions` a propósito:
 * son las dos caras de lo mismo, y separarlas es la forma segura de que el
 * desplegable acabe insertando algo que el buscador no reconoce.
 */
export function handleFor(
  person: MentionablePerson,
  people: MentionablePerson[],
): string {
  const parts = normalize(person.fullName).trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return ''

  const first = parts[0]
  const collides = people.some(
    (other) =>
      other.id !== person.id &&
      normalize(other.fullName).trim().split(/\s+/)[0] === first,
  )

  return collides ? parts.join('') : first
}

/**
 * La mención que se está escribiendo justo antes del cursor.
 *
 * `null` si no hay ninguna. El `(^|\s)` antes de la arroba es lo que evita que
 * escribir un correo abra el menú: en `hola@toromana.com` la arroba viene
 * pegada a una letra, y eso no es una mención.
 */
export function mentionAtCaret(
  value: string,
  caret: number,
): { query: string; start: number } | null {
  const match = value.slice(0, caret).match(/(?:^|\s)@([\p{L}0-9._]*)$/u)
  if (!match) return null

  const query = match[1]
  return { query, start: caret - query.length - 1 }
}

/** La persona a la que responde un handle escrito, si existe alguna. */
export function personForHandle(
  handle: string,
  people: MentionablePerson[],
): MentionablePerson | null {
  const clean = normalize(handle).replace(/^@/, '').replace(/[.]+$/, '')
  return people.find((p) => handlesFor(p).includes(clean)) ?? null
}

export type MentionSegment = {
  text: string
  person: MentionablePerson | null
}

/**
 * Parte el texto en trozos, marcando cuáles son menciones reconocidas.
 *
 * Solo se marca lo que corresponde a alguien del equipo. Que `@juanito` quede
 * sin pintar no es un descuido: es la señal de que esa mención no le llegó a
 * nadie, y verlo en el mensaje publicado es la única forma de enterarse.
 */
export function splitMentions(
  body: string,
  people: MentionablePerson[],
): MentionSegment[] {
  const segments: MentionSegment[] = []
  let last = 0

  for (const match of body.matchAll(/(^|\s)(@[\p{L}0-9_]+)/gu)) {
    const start = (match.index ?? 0) + match[1].length
    const raw = match[2]

    if (start > last) {
      segments.push({ text: body.slice(last, start), person: null })
    }
    segments.push({ text: raw, person: personForHandle(raw, people) })
    last = start + raw.length
  }

  if (last < body.length) {
    segments.push({ text: body.slice(last), person: null })
  }
  return segments
}

/** Todos los `@algo` que aparecen en el texto. */
export function extractHandles(body: string): string[] {
  const matches = normalize(body).match(/@[a-z0-9_.]+/g) ?? []
  return matches.map((m) => m.slice(1).replace(/[.]+$/, '')).filter(Boolean)
}

/**
 * A quién se nombró en el texto.
 *
 * Nunca devuelve al propio autor: nadie necesita un correo contándole lo que
 * acaba de escribir.
 */
export function findMentions(
  body: string,
  people: MentionablePerson[],
  authorId?: string | null,
): MentionablePerson[] {
  const handles = new Set(extractHandles(body))
  if (handles.size === 0) return []

  return people.filter((person) => {
    if (person.id === authorId) return false
    return handlesFor(person).some((handle) => handles.has(handle))
  })
}
