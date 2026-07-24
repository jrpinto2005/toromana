/**
 * Puerta de entrada del módulo para componentes cliente.
 *
 * `index.ts` también expone las queries (dependen de `next/headers` vía
 * `@/lib/supabase/server`); importarlo desde `"use client"` rompe el build.
 * Aquí solo salen server actions y tipos.
 */

export { createHenLot, retireHenLot, recordLotEvent, recordEggProduction } from "./actions";
export type {
  ActionResult,
  CreateHenLotInput,
  EggProductionEntry,
  HenLot,
  HenLotEvent,
  LotEventType,
  RecordEggProductionInput,
  RecordLotEventInput,
} from "./types";
