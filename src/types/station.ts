// ═══════════════════════════════════════════════════════
//  types/station.ts — YouBike 站點資料模型
// ═══════════════════════════════════════════════════════

/** YouBike API 原始回傳 (data.taipei / TDX 格式) */
export interface YouBikeStationRaw {
  readonly sno: string;
  readonly sna: string;
  readonly snaen: string;
  readonly sarea: string;
  readonly sareaen: string;
  readonly lat: number;
  readonly lng: number;
  readonly ar: string;
  readonly aren: string;
  readonly tot: number;
  readonly sbi: number;
  readonly bemp: number;
  readonly act: 0 | 1;
  readonly mday: string;
}

/** 前端正規化後的站點模型 */
export interface Station {
  readonly id: string;
  readonly name: string;
  readonly nameEn: string;
  readonly district: string;
  readonly position: readonly [lng: number, lat: number];
  readonly totalSlots: number;
  readonly availableBikes: number;
  readonly emptySlots: number;
  readonly isActive: boolean;
  readonly updatedAt: number;
}

/** YouBikeStationRaw → Station 正規化 */
export function normalizeStation(raw: YouBikeStationRaw): Station {
  return {
    id: raw.sno,
    name: raw.sna,
    nameEn: raw.snaen,
    district: raw.sarea,
    position: [raw.lng, raw.lat] as const,
    totalSlots: raw.tot,
    availableBikes: raw.sbi,
    emptySlots: raw.bemp,
    isActive: raw.act === 1,
    updatedAt: new Date(raw.mday).getTime(),
  };
}
