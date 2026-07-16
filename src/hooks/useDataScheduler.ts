// ═══════════════════════════════════════════════════════
//  hooks/useDataScheduler.ts — 資料流排程器
//
//  職責：管理車輛 (60s) 與陰影 (15min) 兩個 polling 循環，
//  並與 Page Visibility 休眠/喚醒邏輯整合。
// ═══════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';
import { usePageVisibility, type WakeStrategy } from './usePageVisibility';
import type { AppStore } from '../store/AppStore';
import { timestampToSlotKey, slotKeyToCdnUrl } from '../core/shadeTimeSlot';

const BIKE_INTERVAL = 60_000;      // 60 秒
const SHADE_INTERVAL = 900_000;    // 15 分鐘

/** YouBike API 端點 (可由環境變數覆蓋) */
const BIKE_API_BASE = '/mock_stations.json';

export function useDataScheduler(
  store: AppStore,
  mapRef: React.RefObject<maplibregl.Map | null>,
): void {
  const bikeTimerRef = useRef<number | null>(null);
  const shadeTimerRef = useRef<number | null>(null);

  // ── 車輛資料抓取 ──
  const fetchBikes = useCallback(
    async (bounds?: [number, number, number, number]) => {
      try {
        const url = BIKE_API_BASE;
        const res = await fetch(url);
        if (!res.ok) return;
        const raw = await res.json();
        store.updateStations(raw);
      } catch {
        // 網路錯誤靜默處理，下一個 interval 會重試
      }
    },
    [store],
  );

  // ── 陰影資料抓取 (含 LRU 預抓取) ──
  const fetchShade = useCallback(async () => {
    try {
      const slotKey = timestampToSlotKey(Date.now());
      const { needsFetch } = store.shadowCache.advanceTo(slotKey);

      // 並行抓取所有需要的 slot（最多 3 個，通常 1 個）
      await Promise.all(
        needsFetch.map(async (key) => {
          const url = slotKeyToCdnUrl(key);
          const res = await fetch(url);
          if (!res.ok) return;
          const grid = await res.json();
          store.shadowCache.set(key, {
            slotKey: key,
            timestamp: Date.now(),
            grid,
          });
        }),
      );

      // 將 current slot 設為 active shade
      const current = store.shadowCache.get(slotKey);
      if (current) {
        store.updateShadeLayer(current);
      }
    } catch {
      // 靜默處理
    }
  }, [store]);

  // ── Timer 管理 ──
  const startTimers = useCallback(() => {
    // 避免重複啟動
    if (bikeTimerRef.current !== null) return;
    bikeTimerRef.current = window.setInterval(
      () => void fetchBikes(),
      BIKE_INTERVAL,
    );
    shadeTimerRef.current = window.setInterval(
      () => void fetchShade(),
      SHADE_INTERVAL,
    );
  }, [fetchBikes, fetchShade]);

  const stopTimers = useCallback(() => {
    if (bikeTimerRef.current !== null) {
      clearInterval(bikeTimerRef.current);
      bikeTimerRef.current = null;
    }
    if (shadeTimerRef.current !== null) {
      clearInterval(shadeTimerRef.current);
      shadeTimerRef.current = null;
    }
  }, []);

  // ── Page Visibility 整合 (ADR #3) ──
  usePageVisibility({
    onSleep: () => {
      stopTimers();
      // 凍結 MapLibre 動畫以省電
      mapRef.current?.stop();
    },
    onWake: (strategy: WakeStrategy) => {
      switch (strategy.type) {
        case 'full-reload':
          void fetchBikes();
          void fetchShade();
          break;
        case 'incremental':
          void fetchBikes(strategy.bounds);
          break;
        case 'noop':
          break;
      }
      startTimers();
    },
    getMapBounds: () => {
      const b = mapRef.current?.getBounds();
      if (!b) return null;
      return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    },
  });

  // ── 初始載入 ──
  useEffect(() => {
    void Promise.all([fetchBikes(), fetchShade()]).then(() => {
      startTimers();
    });
    return stopTimers;
  }, [fetchBikes, fetchShade, startTimers, stopTimers]);
}
