// ═══════════════════════════════════════════════════════
//  core/spatialIndex.ts — H3 O(1) 空間索引
//
//  設計決策：
//  因為後端使用 Uber H3 網格演算法產生陰影，
//  我們在前端也使用 h3-js 將站點座標轉換為 H3 Index，
//  直接進行 O(1) 的 Map 查詢，達到完美的精準度。
// ═══════════════════════════════════════════════════════

import { latLngToCell } from 'h3-js';
import type { ShadeSnapshot, ShadeCellProperties } from '../types/shadow';

export class ShadeGridSpatialIndex {
  private readonly buckets: Map<string, ShadeCellProperties>;

  constructor(shade: ShadeSnapshot) {
    this.buckets = new Map();

    for (const feature of shade.grid.features) {
      // 依賴後端傳來的 cellId (H3 index)
      const cellId = feature.properties.cellId;
      if (cellId) {
        this.buckets.set(cellId, feature.properties);
      }
    }
  }

  /** O(1) 查詢 — 站點座標落入哪個 H3 cell */
  query(position: readonly [number, number]): ShadeCellProperties | null {
    try {
      // H3 預設經緯度順序為 (lat, lng)，而我們的 position 是 [lng, lat]
      const h3Index = latLngToCell(position[1], position[0], 9);
      return this.buckets.get(h3Index) ?? null;
    } catch {
      return null;
    }
  }

  /** 快取中的 cell 數量 */
  get size(): number {
    return this.buckets.size;
  }
}
