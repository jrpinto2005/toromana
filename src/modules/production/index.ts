/**
 * Módulo de producción — API pública.
 *
 * Los demás módulos importan SOLO desde aquí, nunca de queries.ts o actions.ts
 * directamente.
 */

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

export { listHenLots, getHenLot, listLotEvents, listEggProduction } from "./queries";
export { createHenLot, retireHenLot, recordLotEvent, recordEggProduction } from "./actions";

// ── Planeación de producción ──
export {
  layingRate,
  smallEggShare,
  fitModel,
  PRIOR,
  WEEKS_TO_LAY,
  PRODUCTIVE_WEEKS,
  type CurveParams,
  type Model,
  type LotEffect,
  type Observation,
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

export {
  getPlanningInputs,
  getWeeklyDemandEggs,
  type PlanningInputs,
  type LotHistory,
} from "./planning-queries";
