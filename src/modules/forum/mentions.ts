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
