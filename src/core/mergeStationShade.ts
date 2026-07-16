// ═══════════════════════════════════════════════════════
//  core/mergeStationShade.ts — 雙流合併純函數
//
//  職責：將「即時 YouBike 車輛」與「當前 15 分鐘陰影」
//  進行效能最佳化的比對，產出每個站點的 ViewModel。
//
//  此為純函數，無副作用、無 DOM 存取，方便單元測試。
// ═══════════════════════════════════════════════════════

import type { Station } from '../types/station';
import type { ShadeSnapshot, ShadeCellProperties } from '../types/shadow';
import type { StationMarkerViewModel, ShadeStatus } from '../types/state';
import type { ShadeGridSpatialIndex } from './spatialIndex';

/** shadowIntensity 浮點比較閾值 — 過濾伺服器端精度誤差 */
const INTENSITY_EPSILON = 0.05;

/** 合併輸出 */
export interface MergeResult {
  readonly nextViewModels: ReadonlyMap<string, StationMarkerViewModel>;
  readonly changedIds: ReadonlySet<string>;
}

/**
 * 核心合併 — 在 bike-update 或 shade-update 時呼叫
 *
 * 設計決策：
 * 1. 空間索引由呼叫方傳入（只在陰影更新時重建）
 * 2. prevViewModels 用於 Diff — 避免無變化時推送
 * 3. shadowIntensity 使用閾值過濾浮點抖動
 */
export function mergeStationShade(
  stations: ReadonlyMap<string, Station>,
  shade: ShadeSnapshot | null,
  prevViewModels: ReadonlyMap<string, StationMarkerViewModel>,
  spatialIndex: ShadeGridSpatialIndex | null,
): MergeResult {
  const nextViewModels = new Map<string, StationMarkerViewModel>();
  const changedIds = new Set<string>();

  for (const [id, station] of stations) {
    // ── Step 1: 空間查詢 ──
    const cell: ShadeCellProperties | null =
      spatialIndex?.query(station.position) ?? null;

    const shadeStatus: ShadeStatus = cell
      ? (cell.inShadow ? 'shade' : 'sun')
      : 'unknown';

    const shadowIntensity = cell?.shadowIntensity ?? 0;

    // ── Step 2: 組裝 ViewModel ──
    const vm: StationMarkerViewModel = {
      stationId: id,
      position: station.position,
      availableBikes: station.availableBikes,
      emptySlots: station.emptySlots,
      totalSlots: station.totalSlots,
      isActive: station.isActive,
      shadeStatus,
      shadowIntensity,
      lastBikeUpdate: station.updatedAt,
      lastShadeUpdate: shade?.timestamp ?? 0,
    };

    // ── Step 3: Diff — 只標記視覺有變化的站點 ──
    const prev = prevViewModels.get(id);
    if (!prev || hasVisualChange(prev, vm)) {
      changedIds.add(id);
    }

    nextViewModels.set(id, vm);
  }

  return { nextViewModels, changedIds };
}

/**
 * 精準 Diff — 只比較會影響 Marker 外觀的欄位
 *
 * 不比較 position（站點不會移動）
 * shadowIntensity 用 ε 閾值避免浮點抖動觸發無意義重繪
 */
export function hasVisualChange(
  a: StationMarkerViewModel,
  b: StationMarkerViewModel,
): boolean {
  return (
    a.availableBikes !== b.availableBikes ||
    a.emptySlots !== b.emptySlots ||
    a.shadeStatus !== b.shadeStatus ||
    a.isActive !== b.isActive ||
    Math.abs(a.shadowIntensity - b.shadowIntensity) > INTENSITY_EPSILON
  );
}
