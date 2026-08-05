import React, { useEffect, useRef, useMemo, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

import { AppStore } from './store/AppStore';
import { useDataScheduler } from './hooks/useDataScheduler';
import { useMapSync } from './hooks/useMapSync';
import { initMapLayers, updateRouteLayer } from './map/mapLayers';
import { fetchShadeRoutes } from './services/routingService';

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
  const [routingState, setRoutingState] = useState(store.getState().routing);
  const [isRoutingPanelMinimized, setIsRoutingPanelMinimized] = useState(false);

  useEffect(() => {
    (window as any).setRoutePoint = (type: 'start'|'end', id: string, lng: number, lat: number, name: string) => {
      const loc = { type: 'station' as const, id, coord: [lng, lat] as [number, number], name };
      if (type === 'start') store.setRoutingStart(loc);
      else store.setRoutingEnd(loc);
      
      setTimeout(() => fetchShadeRoutes(store), 50);
    };
    return () => {
      delete (window as any).setRoutePoint;
    };
  }, [store]);

  useEffect(() => {
    return store.subscribe('routing', () => {
      const newRouting = store.getState().routing;
      setRoutingState(newRouting);
      updateRouteLayer(mapRef.current, newRouting.routes, newRouting.bestRouteId);
      
      // 如果成功找到路線，自動縮小面板；如果被清空，自動展開
      if (newRouting.bestRouteId) {
        setIsRoutingPanelMinimized(true);
      } else if (!newRouting.startLocation && !newRouting.endLocation) {
        setIsRoutingPanelMinimized(false);
      }
    });
  }, [store]);

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
      
      map.on('click', 'station-points', (e) => {
        if (!e.features || e.features.length === 0) return;
        
        // 終極解法：強制轉為 any，完全跳過 TypeScript 龜毛的屬性檢查
        const feature: any = e.features[0];
        if (!feature) return;

        const coords = feature.geometry.coordinates.slice();
        const props = feature.properties || {};

        while (Math.abs(e.lngLat.lng - coords[0]) > 180) {
          coords[0] += e.lngLat.lng > coords[0] ? 360 : -360;
        }

        const stationName = props.name ? String(props.name).replace('YouBike2.0_', '') : '未知站點';
        
        const html = `
          <div style="padding: 2px; font-family: sans-serif; min-width: 170px;">
            <div style="font-size: 15px; font-weight: bold; color: #1f2937; margin-bottom: 10px; border-bottom: 1px solid #f3f4f6; padding-bottom: 8px;">
              🚲 ${stationName}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; color: #6b7280;">2.0 可借數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #f59e0b;">${props.availableBikes ?? 0}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-size: 13px; color: #6b7280;">2.0E 可借數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #f59e0b;">0</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 13px; color: #6b7280;">可停車柱數量</span>
              <span style="font-size: 15px; font-weight: 800; color: #22c55e;">${props.emptySlots ?? 0}</span>
            </div>
            <div style="margin-top: 12px; display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid #f3f4f6;">
              <button onclick="window.setRoutePoint('start', '${props.stationId}', ${coords[0]}, ${coords[1]}, '${stationName}')" style="flex: 1; padding: 6px; border: none; border-radius: 6px; background: #f3f4f6; color: #374151; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">設為起點</button>
              <button onclick="window.setRoutePoint('end', '${props.stationId}', ${coords[0]}, ${coords[1]}, '${stationName}')" style="flex: 1; padding: 6px; border: none; border-radius: 6px; background: #0ea5e9; color: white; font-weight: bold; cursor: pointer; font-size: 13px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">設為終點</button>
            </div>
          </div>
        `;

        new maplibregl.Popup({ offset: 15, closeButton: false })
          .setLngLat(coords as [number, number])
          .setHTML(html)
          .addTo(map);
      });

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

      {/* 導航狀態面板 */}
      {(routingState.startLocation || routingState.endLocation) && (
        <div style={{
          position: 'absolute', top: isMobile ? 80 : 100, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)',
          padding: '16px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          zIndex: 20, width: isMobile ? '90%' : '400px', border: '1px solid rgba(255,255,255,0.6)',
          fontFamily: 'sans-serif'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isRoutingPanelMinimized ? 0 : '12px' }}>
            <h4 style={{ margin: 0, color: '#1f2937', fontWeight: 'bold' }}>🧭 智慧避暑導航</h4>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {routingState.isLoading && <span style={{ fontSize: '12px', color: '#0ea5e9', fontWeight: 'bold' }}>🔄 規劃中...</span>}
              <button 
                onClick={() => setIsRoutingPanelMinimized(!isRoutingPanelMinimized)} 
                style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', padding: '4px 8px', color: '#4b5563', fontWeight: 'bold' }}
              >
                {isRoutingPanelMinimized ? '展開 🔽' : '收合 🔼'}
              </button>
            </div>
          </div>
          
          {!isRoutingPanelMinimized && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                  <span style={{ color: '#6b7280' }}>起點：</span>
                  <span style={{ fontWeight: 'bold', color: routingState.startLocation ? '#111' : '#9ca3af' }}>
                    {routingState.startLocation?.name || '請點擊地圖站點'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>終點：</span>
                  <span style={{ fontWeight: 'bold', color: routingState.endLocation ? '#111' : '#9ca3af' }}>
                    {routingState.endLocation?.name || '請點擊地圖站點'}
                  </span>
                </div>
              </div>
              
              {!routingState.startLocation && (
                <button 
                  onClick={() => {
                    const mockGps = { type: 'gps' as const, coord: [121.565, 25.058] as [number, number], name: '📍 目前位置 (GPS)' };
                    store.setRoutingStart(mockGps);
                    setTimeout(() => fetchShadeRoutes(store), 50);
                  }}
                  style={{ width: '100%', padding: '10px', background: '#f3f4f6', border: '1px solid #d1d5db', borderRadius: '8px', marginBottom: '12px', cursor: 'pointer', fontWeight: 'bold', color: '#4b5563' }}
                >
                  從目前位置 (GPS) 出發
                </button>
              )}

              {!routingState.isLoading && routingState.bestRouteId && (() => {
                const bestRoute = routingState.routes.find(r => r.id === routingState.bestRouteId);
                return (
                  <div style={{ background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.3)', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
                    <div style={{ color: '#0369a1', fontWeight: 'bold', marginBottom: '6px', fontSize: '15px' }}>❄️ 冰藍色特效路線已就緒！</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0c4a6e', marginBottom: '4px' }}>
                      <span>陰影覆蓋率：</span>
                      <span style={{ fontWeight: '900', fontSize: '15px' }}>{Math.round((bestRoute?.shadeScore || 0) * 100)}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#0c4a6e' }}>
                      <span>預估騎乘時間：</span>
                      <span style={{ fontWeight: 'bold' }}>{Math.round((bestRoute?.duration || 0) / 60)} 分鐘</span>
                    </div>
                  </div>
                );
              })()}

              <button 
                onClick={() => {
                  store.clearRouting();
                }}
                style={{ width: '100%', padding: '10px', background: '#fee2e2', color: '#ef4444', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}
              >
                結束導航
              </button>
            </>
          )}
        </div>
      )}

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
            <div style={{ width: 16, height: 16, backgroundColor: 'rgba(156, 163, 175, 0.3)', border: '1px solid rgba(156, 163, 175, 0.6)', marginRight: 10 }} />
            <span><b>灰色網格：</b>陽光直射區</span>
          </div>
        </div>
      )}
    </div>
  );
}
