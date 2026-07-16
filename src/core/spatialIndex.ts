import { latLngToCell } from 'h3-js';
import type { ShadeSnapshot, ShadeCellProperties } from '../types/shadow';

export class ShadeGridSpatialIndex {
  private readonly buckets: Map<string, ShadeCellProperties>;

  constructor(shade: ShadeSnapshot) {
    this.buckets = new Map();

    for (const feature of shade.grid.features) {
      const cellId = feature.properties.cellId;
      if (cellId) {
        this.buckets.set(cellId, feature.properties);
      }
    }
  }

  query(position: readonly [number, number]): ShadeCellProperties | null {
    try {
      const h3Index = latLngToCell(position[1], position[0], 9);
      return this.buckets.get(h3Index) ?? null;
    } catch {
      return null;
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}
