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
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

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
      center: [120.635, 24.16],   // 台中市西屯區
      zoom: 14,                   // 稍微拉近一點
      pitch: 45,                  // 傾斜角度 (給它 3D 感！)
      bearing: -17.6,             // 稍微旋轉一點點
    });

    map.on('load', () => {
      // 初始化圖層（此時 stations 可能還是空的，排程器會很快填充）
      initMapLayers(map, store.getState().stations, store.getState().viewModels,store.getState().activeShade);
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
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div
        id="map-container"
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* 圖例說明 Legend */}
      <div
        style={{
          position: 'absolute',
          bottom: 30,
          right: 30,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          padding: '16px 20px',
          borderRadius: '12px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          fontFamily: 'sans-serif',
          zIndex: 10,
          pointerEvents: 'none', // 讓滑鼠點擊穿透，不阻擋地圖操作
          fontSize: '14px',
          color: '#333',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111' }}>
          圖例說明 (DEMO 早上十點)
        </h4>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#51bbd6', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          <span><b>藍色圈圈：</b>多個站點群聚 (站點數)</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          <span><b>橘色圈圈：</b>曝曬在陽光下 (可借車數)</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
          <span><b>綠色圈圈：</b>隱藏在陰影下 (可借車數)</span>
        </div>
        
        <div style={{ borderTop: '1px solid #ddd', margin: '12px 0' }} />
        
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
          <div style={{ width: 16, height: 16, backgroundColor: 'rgba(34, 139, 34, 0.3)', border: '1px solid rgba(34, 139, 34, 0.5)', marginRight: 10 }} />
          <span><b>綠色網格：</b>高樓大廈陰影區</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 16, height: 16, backgroundColor: 'rgba(255, 255, 255, 0)', border: '1px solid #ccc', marginRight: 10 }} />
          <span><b>透明網格 (透出底圖)：</b>陽光直射區</span>
        </div>
      </div>
    </div>
  );
}
