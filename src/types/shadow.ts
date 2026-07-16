// ═══════════════════════════════════════════════════════
//  types/shadow.ts — 陰影網格與快取型別
// ═══════════════════════════════════════════════════════

import type { Feature, FeatureCollection, Polygon } from 'geojson';

/** 陰影網格 Cell 的 properties */
export interface ShadeCellProperties {
  readonly cellId: string;
  readonly inShadow: boolean;
  readonly shadowIntensity: number; // 0.0 (全日照) → 1.0 (全遮蔽)
}

/** GeoJSON Feature 型別特化 */
export type ShadeCellFeature = Feature<Polygon, ShadeCellProperties>;

/** 一個 15 分鐘時間區塊的陰影快照 */
export interface ShadeSnapshot {
  readonly slotKey: string;   // e.g. "taipei_1000"
  readonly timestamp: number; // Unix ms
  readonly grid: FeatureCollection<Polygon, ShadeCellProperties>;
}

/**
 * 15 分鐘時段 Key — LRU Cache 的索引
 * 格式: "{city}_{HHMM}" e.g. "taipei_1015"
 */
export type ShadeSlotKey = string;

/** 3-Slot 快取的當前窗口狀態 */
export interface ShadowCacheWindow {
  readonly prev: ShadeSlotKey | null;
  readonly current: ShadeSlotKey;
  readonly next: ShadeSlotKey | null;
}
