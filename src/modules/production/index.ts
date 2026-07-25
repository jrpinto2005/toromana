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
