/**
 * Puerta de entrada del módulo para componentes cliente.
 *
 * `index.ts` también expone las queries (dependen de `next/headers` vía
 * `@/lib/supabase/server`); importarlo desde `"use client"` rompe el build.
 * Aquí solo salen server actions y tipos.
 */

export { createHenLot, retireHenLot, recordLotEvent, recordEggProduction } from "./actions";
export type { WeeklyLayingRate } from "./queries";
export type {
  ActionResult,
  CreateHenLotInput,
  EggProductionEntry,
  EggSize,
  HenLot,
  HenLotEvent,
  LotEventType,
  RecordEggProductionInput,
  RecordLotEventInput,
} from "./types";

// La curva y el planificador son funciones puras: sirven igual en el navegador,
// y tenerlas ahí permite recalcular un escenario sin ir al servidor.
export {
  layingRate,
  smallEggShare,
  PRIOR,
  WEEKS_TO_LAY,
  PRODUCTIVE_WEEKS,
  type CurveParams,
  type Model,
  type LotEffect,
} from "./curve";

export {
  project,
  plan,
  targetAt,
  MIN_LOT,
  LOT_STEP,
  type Calendar,
  type PlannedLot,
  type WeekProjection,
  type Purchase,
  type Plan,
  type Target,
} from "./planner";
