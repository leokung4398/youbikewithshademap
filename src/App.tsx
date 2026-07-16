// ═══════════════════════════════════════════════════════
//  App.tsx — 組裝入口
//
//  將所有模組組裝在一起：
//  - AppStore 實例化
//  - MapLibre 初始化
//  - Hooks 掛載 (排程器、地圖同步、省電)
// ═══════════════════════════════════════════════════════

import { useEffect, useRef, useMemo } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AppStore } from './store/AppStore';
import { useDataScheduler } from './hooks/useDataScheduler';
import { useMapSync } from './hooks/useMapSync';
import { initMapLayers } from './map/mapLayers';

/** 地圖樣式 — 使用免費的 MapTiler 或自訂 style */
const MAP_STYLE = 'https://demotiles.maplibre.org/style.json';

export function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // ── 單例 Store ──
  const store = useMemo(() => new AppStore(), []);

  // ── 初始化 MapLibre ──
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [121.5654, 25.0330],   // 台北市中心
      zoom: 13,
    });

    map.on('load', () => {
      // 初始化圖層（此時 stations 可能還是空的，排程器會很快填充）
      initMapLayers(map, store.getState().stations);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [store]);

  // ── 掛載排程器 (bike 60s / shade 15min / 省電) ──
  useDataScheduler(store, mapRef);

  // ── 掛載地圖同步 (setFeatureState 增量推送) ──
  useMapSync(store, mapRef);

  return (
    <div
      id="map-container"
      ref={mapContainerRef}
      style={{ width: '100%', height: '100vh' }}
    />
  );
}
