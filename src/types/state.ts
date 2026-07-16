// ═══════════════════════════════════════════════════════
//  types/state.ts — 全局 AppState
// ═══════════════════════════════════════════════════════

import type { Station } from './station';
import type { ShadeSnapshot, ShadowCacheWindow } from './shadow';

/** 站點 × 陰影 合併後的視圖模型 */
export type ShadeStatus = 'sun' | 'shade' | 'unknown';

export interface StationMarkerViewModel {
  readonly stationId: string;
  readonly position: readonly [number, number];
  readonly availableBikes: number;
  readonly emptySlots: number;
  readonly totalSlots: number;
  readonly isActive: boolean;
  readonly shadeStatus: ShadeStatus;
  readonly shadowIntensity: number;
  readonly lastBikeUpdate: number;
  readonly lastShadeUpdate: number;
}

/** 頁面可見性狀態 */
export interface VisibilityState {
  readonly isVisible: boolean;
  readonly hiddenSince: number | null;
}

/** 同步元資料 */
export interface SyncMeta {
  readonly lastBikeFetch: number;
  readonly lastShadeFetch: number;
  readonly bikeFetchInterval: number;  // 60_000 ms
  readonly shadeFetchInterval: number; // 900_000 ms
}

/** MapLibre Viewport */
export interface MapViewport {
  readonly center: readonly [number, number];
  readonly zoom: number;
  readonly bounds: readonly [[number, number], [number, number]] | null;
}

/** ═══ 全局狀態樹 ═══ */
export interface AppState {
  // ── 原始資料 ──
  readonly stations: ReadonlyMap<string, Station>;
  readonly activeShade: ShadeSnapshot | null;
  readonly shadowWindow: ShadowCacheWindow | null;

  // ── 衍生快取 ──
  readonly viewModels: ReadonlyMap<string, StationMarkerViewModel>;
  readonly changedIds: ReadonlySet<string>;

  // ── UI / Map ──
  readonly selectedStation: string | null;
  readonly viewport: MapViewport;
  readonly timeSlider: { readonly currentTime: number; readonly isPlaying: boolean };

  // ── 系統 ──
  readonly visibility: VisibilityState;
  readonly sync: SyncMeta;
}
