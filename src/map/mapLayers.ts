// ═══════════════════════════════════════════════════════
//  map/mapLayers.ts — MapLibre 圖層初始化
//
//  ADR #2: Day 1 啟用 cluster: true
//  - Zoom ≤ 14: 顯示聚合泡泡 (區域總車輛數)
//  - Zoom > 14: 渲染獨立站點 (🌞 / 🌲 顏色)
// ═══════════════════════════════════════════════════════

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { Station } from '../types/station';

/**
 * 初始化所有地圖圖層
 *
 * 調用時機：map 'load' 事件觸發後
 */
export function initMapLayers(
  map: MaplibreMap,
  stations: ReadonlyMap<string, Station>,
): void {
  // ══════════════════════════════
  //  A. 陰影填充圖層 (底層)
  // ══════════════════════════════
  map.addSource('shade-grid', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'shade-fill',
    type: 'fill',
    source: 'shade-grid',
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['get', 'inShadow'], false],
        'rgba(34, 139, 34, 0.3)',    // 🌲 半透明綠
        'rgba(0, 0, 0, 0)',          // 日照：完全透明
      ],
      'fill-opacity': 0.6,
    },
  });

  // ══════════════════════════════
  //  B. 站點 Source — Clustering
  // ══════════════════════════════
  const stationGeoJSON = stationsToFeatureCollection(stations);

  map.addSource('stations', {
    type: 'geojson',
    data: stationGeoJSON,
    cluster: true,                     // ⚡ ADR #2
    clusterRadius: 60,
    clusterMaxZoom: 14,                // Zoom > 14 停止聚合
    clusterProperties: {
      // 聚合時累加：區域總可借車輛數
      totalBikes: ['+', ['get', 'availableBikes']],
      totalEmpty: ['+', ['get', 'emptySlots']],
    },
    promoteId: 'stationId',            // 啟用 setFeatureState
  });

  // ── B1. 聚合泡泡 (Zoom ≤ 14) ──
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'stations',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',       // < 20 站
        20, '#f1f075',   // 20~50 站
        50, '#f28cb1',   // > 50 站
      ],
      'circle-radius': [
        'step',
        ['get', 'point_count'],
        20,
        20, 30,
        50, 40,
      ],
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
    },
  });

  // ── B2. 聚合數字標籤 ──
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'stations',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': [
        'concat',
        ['to-string', ['get', 'totalBikes']],
        ' 🚲',
      ],
      'text-size': 13,
    },
    paint: {
      'text-color': '#333333',
    },
  });

  // ── B3. 獨立站點 (Zoom > 14) ──
  map.addLayer({
    id: 'station-points',
    type: 'circle',
    source: 'stations',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'case',
        ['==', ['feature-state', 'shadeStatus'], 'shade'],
        '#22c55e',        // 🌲 綠色
        ['==', ['feature-state', 'shadeStatus'], 'sun'],
        '#f59e0b',        // 🌞 橘黃
        '#9ca3af',        // unknown 灰色
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['feature-state', 'bikes'],
        0, 12,
        30, 22,
      ],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
    },
  });
    // ── B4. 獨立站點數字標籤 ──
  map.addLayer({
    id: 'station-points-count',
    type: 'symbol',
    source: 'stations',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'text-field': [
        'to-string',
        ['get', 'availableBikes'],
      ],
      'text-size': 12,
    },
    paint: {
      'text-color': '#1f2937',
      'text-halo-color': 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  });
}

/** Station Map → GeoJSON FeatureCollection */
function stationsToFeatureCollection(
  stations: ReadonlyMap<string, Station>,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: Array.from(stations.values()).map((s) => ({
      type: 'Feature' as const,
      id: s.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [...s.position],
      },
      properties: {
        stationId: s.id,
        name: s.name,
        availableBikes: s.availableBikes,
        emptySlots: s.emptySlots,
        totalSlots: s.totalSlots,
        district: s.district,
      },
    })),
  };
}
