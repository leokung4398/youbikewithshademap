// ═══════════════════════════════════════════════════════
//  App.tsx — 行動裝置友善旗艦版 (點擊彈窗 + 松山區圖例)
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

  const [sliderHour, setSliderHour] = useState<number>(10);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showLegend, setShowLegend] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setShowLegend(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const store = useMemo(() => new AppStore(), []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLE,
      center: [121.558, 25.055],
      zoom: isMobile ? 13.5 : 14.5, 
      pitch: 45,
      bearing: -17.6,
      attributionControl: false,
    });

    map.on('load', () => {
      initMapLayers(map, store.getState().stations, store.getState().viewModels, store.getState().activeShade);
      fetchShadeByHour(10);
      
      // ✨ 新增：點擊站點顯示超美彈出視窗 (Popup)
      map.on('click', 'station-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        const feature = e.features[0];
        const coords = (feature.geometry as any).coordinates.slice();
        const props = feature.properties;

        // 確保地圖縮放或平移時，彈窗位置指得準確
        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        // 高質感 HTML UI 彈出視窗設計
        const stationName = props.name.replace('YouBike2.0_', ''); // 把落落長的前綴拿掉，畫面更乾淨
        const html = `
          <div style="padding: 2px; font-family: sans-serif; min-width: 170px;">
            <div style="font-size: 15px; font-weight: bold; color: #1f2937; margin-bottom: 10px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px;">
              🚲 ${stationName}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; color: #6b7280;">2.0 可借數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #f59e0b;">${props.availableBikes}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; color: #6b7280;">2.0E 可借數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #f59e0b;">0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: #6b7280;">可停車柱數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #22c55e;">${props.emptySlots}</span>
            </div>
          </div>
        `;

        new maplibregl.Popup({ offset: 15, closeButton: false })
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map);
      });

      // 滑鼠懸停在站點上時，游標變成手指
      map.on('mouseenter', 'station-points', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'station-points', () => {
        map.getCanvas().style.cursor = '';
      });
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [store, isMobile]);

  useDataScheduler(store, mapRef);
  useMapSync(store, mapRef);

  const fetchShadeByHour = (hour: number) => {
    const slotKey = `taipei_${hour.toString().padStart(2, '0')}00`;
    const url = `cdn/shade/shade_taipei_${hour.toString().padStart(2, '0')}00.geojson`;
    fetch(import.meta.env.BASE_URL + url)
      .then(res => res.json())
      .then(grid => {
        store.updateShadeLayer({
          slotKey,
          timestamp: Date.now(),
          grid
        });
      })
      .catch(() => console.log("等待 GitHub Action 產出資料中..."));
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newHour = parseInt(e.target.value, 10);
    setSliderHour(newHour);
    fetchShadeByHour(newHour);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden' }}>
      <div
        id="map-container"
        ref={mapContainerRef}
        style={{ width: '100%', height: '100%' }}
      />
      
      {/* 🌞 頂部高質感時間拉桿 */}
      <div
        style={{
          position: 'absolute',
          top: isMobile ? 16 : 30,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          padding: isMobile ? '12px 20px' : '16px 24px',
          borderRadius: '50px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          display: 'flex',
          alignItems: 'center',
          gap: isMobile ? '12px' : '20px',
          zIndex: 20,
          width: isMobile ? '90%' : '400px',
          border: '1px solid rgba(255, 255, 255, 0.5)'
        }}
      >
        <div style={{ fontWeight: 'bold', fontSize: isMobile ? '14px' : '16px', color: '#333', whiteSpace: 'nowrap' }}>
          🕒 {sliderHour.toString().padStart(2, '0')}:00
        </div>
        <input 
          type="range" 
          min="8" max="17" step="1"
          value={sliderHour} 
          onChange={handleTimeChange}
          style={{ flex: 1, cursor: 'pointer', accentColor: '#22c55e' }}
        />
      </div>

      {/* 📱 手機版圖例收合按鈕 */}
      {isMobile && !showLegend && (
        <button
          onClick={() => setShowLegend(true)}
          style={{
            position: 'absolute',
            bottom: 24,
            right: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.6)',
            padding: '10px 16px',
            borderRadius: '24px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            color: '#333',
            fontWeight: 'bold',
            fontSize: '14px',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          📖 圖例說明
        </button>
      )}

      {/* 📖 圖例說明面板 */}
      {showLegend && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? 16 : 30,
            right: isMobile ? 16 : 30,
            left: isMobile ? 16 : 'auto',
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            padding: isMobile ? '16px' : '16px 20px',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            fontFamily: 'sans-serif',
            zIndex: 10,
            fontSize: isMobile ? '13px' : '14px',
            color: '#333',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            {/* ✨ 更改為松山區 */}
            <h4 style={{ margin: 0, fontSize: isMobile ? '14px' : '15px', fontWeight: 'bold', color: '#111' }}>
              圖例說明 (DEMO地區：松山區)
            </h4>
            {isMobile && (
              <button 
                onClick={() => setShowLegend(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#666', padding: 0, cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#51bbd6', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            <span><b>藍色圈圈：</b>多個站點群聚 (站點數)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#f59e0b', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            <span><b>橘色圈圈：</b>曝曬在陽光下 (可借車數)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', backgroundColor: '#22c55e', border: '2px solid white', marginRight: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            <span><b>綠色圈圈：</b>隱藏在陰影下 (可借車數)</span>
          </div>
          <div style={{ borderTop: '1px solid rgba(0,0,0,0.1)', margin: '12px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ width: 16, height: 16, backgroundColor: 'rgba(34, 139, 34, 0.3)', border: '1px solid rgba(34, 139, 34, 0.4)', marginRight: 10 }} />
            <span><b>綠色網格：</b>高樓大廈陰影避暑區</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* ✨ 更改為灰色網格 */}
            <div style={{ width: 16, height: 16, backgroundColor: 'rgba(156, 163, 175, 0.3)', border: '1px solid rgba(156, 163, 175, 0.6)', marginRight: 10 }} />
            <span><b>灰色網格：</b>陽光直射區</span>
          </div>
        </div>
      )}
    </div>
  );
}
