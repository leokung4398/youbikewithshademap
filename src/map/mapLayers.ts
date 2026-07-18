// ═══════════════════════════════════════════════════════
//  map/mapLayers.ts — MapLibre 圖層初始化
// ═══════════════════════════════════════════════════════

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { Station } from '../types/station';

export function initMapLayers(
  map: MaplibreMap,
  stations: ReadonlyMap<string, Station>,
  viewModels: ReadonlyMap<string, any>,
  activeShade: any | null,
): void {
  // ══════════════════════════════
  //  A. 陰影填充圖層 (底層)
  // ══════════════════════════════
  map.addSource('shade-grid', {
    type: 'geojson',
    data: activeShade ? activeShade.grid : { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'shade-fill',
    type: 'fill',
    source: 'shade-grid',
    paint: {
      'fill-color': [
        'case',
        ['boolean', ['get', 'inShadow'], false],
        'rgba(34, 139, 34, 0.3)',    // 🌲 陰影區：綠色網格
        'rgba(156, 163, 175, 0.3)',  // 🌞 陽光直射：灰色網格
      ],
      'fill-opacity': 0.6,
    },
  });

  // ══════════════════════════════
  //  B. 站點 Source — Clustering
  // ══════════════════════════════
  const stationGeoJSON = stationsToFeatureCollection(stations, viewModels);

  map.addSource('stations', {
    type: 'geojson',
    data: stationGeoJSON,
    cluster: true,
    clusterRadius: 60,
    clusterMaxZoom: 14,
    clusterProperties: {
      totalBikes: ['+', ['get', 'availableBikes']],
      totalEmpty: ['+', ['get', 'emptySlots']],
    },
    promoteId: 'stationId',
  });

  // ── B1. 聚合泡泡 ──
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'stations',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step',
        ['get', 'point_count'],
        '#51bbd6',       
        20, '#f1f075',   
        50, '#f28cb1',   
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

  // ── B3. 獨立站點 ──
  map.addLayer({
    id: 'station-points',
    type: 'circle',
    source: 'stations',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'case',
        ['==', ['coalesce', ['feature-state', 'shadeStatus'], ['get', 'shadeStatus']], 'shade'],
        '#22c55e',        // 🌲 綠色
        ['==', ['coalesce', ['feature-state', 'shadeStatus'], ['get', 'shadeStatus']], 'sun'],
        '#f59e0b',        // 🌞 橘黃
        '#9ca3af',        // unknown 灰色
      ],
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['feature-state', 'bikes'], ['get', 'availableBikes']],
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

export function stationsToFeatureCollection(
  stations: ReadonlyMap<string, Station>,
  viewModels: ReadonlyMap<string, any>,
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
        shadeStatus: viewModels.get(s.id)?.shadeStatus ?? 'unknown',
      },
    })),
  };
}
