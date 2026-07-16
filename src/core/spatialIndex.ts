// ═══════════════════════════════════════════════════════
//  core/spatialIndex.ts — Grid Bucket O(1) 空間索引
//
//  設計決策：不使用 R-tree。
//  陰影網格本身就是等距格子，直接用 (col, row) 做 hash key，
//  查詢複雜度 O(1)，建構也只需 O(n) 單次遍歷。
// ═══════════════════════════════════════════════════════

import type { ShadeSnapshot, ShadeCellProperties } from '../types/shadow';

export class ShadeGridSpatialIndex {
  private readonly cellSize: number;
  private readonly buckets: Map<string, ShadeCellProperties>;

  /**
   * @param shade    - 當前時段的陰影快照
   * @param cellSize - 網格邊長 (經緯度)。0.0005 ≈ 50m
   */
  constructor(shade: ShadeSnapshot, cellSize: number = 0.0005) {
    this.cellSize = cellSize;
    this.buckets = new Map();

    for (const feature of shade.grid.features) {
      const [lng, lat] = this.centroid(
        feature.geometry.coordinates[0] as number[][],
      );
      const key = this.toKey(lng, lat);
      this.buckets.set(key, feature.properties);
    }
  }

  /** O(1) 查詢 — 站點座標落入哪個陰影 cell */
  query(position: readonly [number, number]): ShadeCellProperties | null {
    const key = this.toKey(position[0], position[1]);
    return this.buckets.get(key) ?? null;
  }

  /** 座標 → bucket key */
  private toKey(lng: number, lat: number): string {
    const col = Math.floor(lng / this.cellSize);
    const row = Math.floor(lat / this.cellSize);
    return `${col}|${row}`;
  }

  /** 簡易 centroid — 取 polygon ring 座標平均值 */
  private centroid(ring: number[][]): [number, number] {
    let lngSum = 0;
    let latSum = 0;
    // GeoJSON polygon ring: 最後一點是閉合重複，排除
    const n = ring.length - 1;
    for (let i = 0; i < n; i++) {
      lngSum += ring[i]![0]!;
      latSum += ring[i]![1]!;
    }
    return [lngSum / n, latSum / n];
  }

  /** 快取中的 cell 數量 */
  get size(): number {
    return this.buckets.size;
  }
}
