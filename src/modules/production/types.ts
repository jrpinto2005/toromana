import type { IsoDate } from "@/lib/dates";

export type LotEventType = "mortalidad" | "venta" | "ingreso" | "descarte";

/**
 * Los lotes nuevos ponen huevo pequeño sus primeras semanas. Medirlo aparte es
 * lo que deja ver cuándo un lote empieza a producir huevo comercial.
 */
export type EggSize = "normal" | "pequeno";

export type HenLot = {
  id: string;
  code: string;
  entryDate: IsoDate;
  initialCount: number;
  currentCount: number;
  breed: string | null;
  notes: string | null;
  active: boolean;
};

export type HenLotEvent = {
  id: string;
  lotId: string;
  eventDate: IsoDate;
  type: LotEventType;
  quantity: number;
  note: string | null;
};

export type EggProductionEntry = {
  id: string;
  lotId: string;
  lotCode: string;
  weekStart: IsoDate;
  eggs: number;
  size: EggSize;
  note: string | null;
  /** `eggs / (currentCount × 7)`. `null` si el lote no tiene gallinas para dividir. */
  layingRate: number | null;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export type CreateHenLotInput = {
  code: string;
  entryDate: IsoDate;
  initialCount: number;
  breed?: string | null;
  notes?: string | null;
};

export type RecordEggProductionInput = {
  lotId: string;
  weekStart: IsoDate;
  eggs: number;
  size?: EggSize;
  note?: string | null;
};

export type RecordLotEventInput = {
  lotId: string;
  eventDate: IsoDate;
  type: LotEventType;
  quantity: number;
  note?: string | null;
};
