// ═══════════════════════════════════════════════════════
//  hooks/useStationVM.ts — React 18 精準訂閱
//
//  使用 useSyncExternalStore 確保 Concurrent Mode 安全，
//  並實現 per-station 粒度的訂閱。
// ═══════════════════════════════════════════════════════

import { useSyncExternalStore } from 'react';
import type { AppStore } from '../store/AppStore';
import type { StationMarkerViewModel } from '../types/state';

/**
 * 訂閱單一站點 ViewModel
 *
 * 只在該站點的 shadeStatus / availableBikes 等視覺欄位
 * 發生變化時觸發元件 re-render。其他站點更新時不觸發。
 */
export function useStationVM(
  store: AppStore,
  stationId: string,
): StationMarkerViewModel | undefined {
  return useSyncExternalStore(
    (cb) => store.subscribeStation(stationId, cb),
    () => store.getViewModel(stationId),
  );
}

/**
 * 訂閱站點 ID 列表
 *
 * 只在站點新增/移除時觸發 re-render。
 * 車輛數變化、陰影變化都不會觸發此 hook。
 */
export function useStationIds(store: AppStore): string[] {
  return useSyncExternalStore(
    (cb) => store.subscribe('stations', cb),
    () => store.getStationIds(),
  );
}
