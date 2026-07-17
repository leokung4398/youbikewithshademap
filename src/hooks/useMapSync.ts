// ═══════════════════════════════════════════════════════
//  hooks/useMapSync.ts — MapLibre 增量同步
//
//  核心策略：使用 setFeatureState 增量推送，
//  避免 setData 觸發整個 GeoJSON source 的重新解析。
// ═══════════════════════════════════════════════════════

import { useEffect } from 'react';
import type { AppStore } from '../store/AppStore';
import type { ShadeSnapshot } from '../types/shadow';

/**
 * 監聽 viewmodels 變化 → 增量推送到 MapLibre
 *
 * 站點層：setFeatureState (零 GeoJSON 重建)
 * 陰影層：setData (每 15min 一次，可接受)
 */
export function useMapSync(
  store: AppStore,
  mapRef: React.RefObject<maplibregl.Map | null>,
): void {
  // ── 站點外觀增量更新 ──
  useEffect(() => {
    const unsub = store.subscribe('viewmodels', () => {
      const map = mapRef.current;
      if (!map) return;

      const { changedIds, viewModels } = store.getState();

      for (const id of changedIds) {
        const vm = viewModels.get(id);
        if (!vm) continue;

        map.setFeatureState(
          { source: 'stations', id },
          {
            shadeStatus: vm.shadeStatus,
            bikes: vm.availableBikes,
            empty: vm.emptySlots,
            intensity: vm.shadowIntensity,
            active: vm.isActive ? 1 : 0,
          },
        );
      }
    });

    return unsub;
  }, [store, mapRef]);

  // ── 陰影圖層整批替換 (每 15min) ──
  useEffect(() => {
    let lastShadeTimestamp = 0;

    const unsub = store.subscribe('shade', () => {
      const map = mapRef.current;
      if (!map) return;

      const shade: ShadeSnapshot | null = store.getState().activeShade;
      if (!shade || shade.timestamp === lastShadeTimestamp) return;

      lastShadeTimestamp = shade.timestamp;

      const source = map.getSource('shade-grid');
      if (source && 'setData' in source) {
        (source as maplibregl.GeoJSONSource).setData(shade.grid);
      }
    });

    return unsub;
  }, [store, mapRef]);

  // ── 站點座標整批替換 (每 60 秒，因為 DEMO 資料會隨機飄移座標) ──
  useEffect(() => {
    const unsub = store.subscribe('stations', () => {
      const map = mapRef.current;
      if (!map) return;

      const { stations, viewModels } = store.getState();
      const source = map.getSource('stations');
      if (source && 'setData' in source) {
        // 從 mapLayers.ts 引入的 helper
        import('../map/mapLayers').then(({ stationsToFeatureCollection }) => {
          const geojson = stationsToFeatureCollection(stations, viewModels);
          (source as maplibregl.GeoJSONSource).setData(geojson);
        });
      }
    });

    return unsub;
  }, [store, mapRef]);
}
