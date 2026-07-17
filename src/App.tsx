// ═══════════════════════════════════════════════════════
//  App.tsx — 組裝入口
// ═══════════════════════════════════════════════════════

import { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AppStore } from './store/AppStore';
import { useDataScheduler } from './hooks/useDataScheduler';
import { useMapSync } from './hooks/useMapSync';
import { initMapLayers } from './map/mapLayers';

const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  // 狀態管理時間軸 (預設 10 點)
  const [sliderHour, setSliderHour] = useState<number>(10);

  const store = useMemo(() => new AppStore(), []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [120.635, 24.16],
      zoom: 14,
      pitch: 45,
      bearing: -17.6,
    });

    map.on('load', () => {
      initMapLayers(map, store.getState().stations, store.getState().viewModels, store.getState().activeShade);
      
      // 初始載入 10:00 的陰影資料
      fetchShadeByHour(10);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [store]);

  useDataScheduler(store, mapRef);
  useMapSync(store, mapRef);

  // 根據滑桿數值去抓取對應的 GeoJSON
  const fetchShadeByHour = (hour: number) => {
    const url = `cdn/shade/shade_taipei_${hour.toString().padStart(2, '0')}00.geojson`;
    fetch(import.meta.env.BASE_URL + url)
      .then(res => res.json())
      .then(grid => {
        store.updateShadeLayer({
          timestamp: Date.now(), // 給予一個新的時間戳強制更新
          grid
        });
      })
      .catch(err => console.log("等待 GitHub Action 產出資料中..."));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHour = parseInt(e.target.value, 10);
    setSliderHour(newHour);
    fetchShadeByHour(newHour);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div
        id="map-container"
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* 🌞 頂部高質感時間拉桿 */}
      <div
        style={{
          position: 'absolute',
          top: 30,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(10px)',
          padding: '16px 24px',
          borderRadius: '50px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '20px',
          zIndex: 20,
          width: '400px',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333', whiteSpace: 'nowrap' }}>
          🕒 {sliderHour.toString().padStart(2, '0')}:00
        </div>
        <input 
          type="range" 
          min="8" 
          max="17" 
          step="1"
          value={sliderHour} 
          onChange={handleTimeChange}
          style={{
            flex: 1,
            cursor: 'pointer',
            accentColor: '#22c55e'
          }}
        />
      </div>

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
          pointerEvents: 'none',
          fontSize: '14px',
          color: '#333',
        }}
      >
        <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 'bold', color: '#111' }}>
          圖例說明 (DEMO 時間軸)
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
