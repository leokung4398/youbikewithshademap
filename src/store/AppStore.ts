// ═══════════════════════════════════════════════════════
//  store/AppStore.ts — 輕量 Pub/Sub 狀態管理核心
//
//  設計決策：不使用 Redux / Zustand。
//  此場景的瓶頸在 MapLibre，而非 React 樹。
//  輕量 pub/sub 能精確控制「什麼時候通知誰」。
// ═══════════════════════════════════════════════════════

import type { YouBikeStationRaw, Station } from '../types/station';
import type { ShadeSnapshot } from '../types/shadow';
import type { AppState, StationMarkerViewModel } from '../types/state';
import { normalizeStation } from '../types/station';
import { mergeStationShade } from '../core/mergeStationShade';
import { ShadeGridSpatialIndex } from '../core/spatialIndex';
import { ShadowLRUCache } from './ShadowLRUCache';

/** Pub/Sub 頻道型別 */
type Channel = 'stations' | 'shade' | 'viewmodels' | `station:${string}`;
type Listener = () => void;

export class AppStore {
  private state: AppState;
  private spatialIndex: ShadeGridSpatialIndex | null = null;
  private readonly listeners = new Map<Channel, Set<Listener>>();
  private stationIdsCached: string[] = [];

  /** 暴露 LRU Cache 供排程器存取 */
  readonly shadowCache = new ShadowLRUCache();

  constructor() {
    this.state = createInitialState();
  }

  // ═══════════ 讀取 ═══════════

  getState(): AppState {
    return this.state;
  }

  getViewModel(id: string): StationMarkerViewModel | undefined {
    return this.state.viewModels.get(id);
  }

  getStationIds(): string[] {
    return this.stationIdsCached;
  }

  // ═══════════ 寫入 ═══════════

  /** 車輛更新 — 每 60 秒 */
  updateStations(rawList: YouBikeStationRaw[]): void {
    const next = new Map<string, Station>();
    for (const raw of rawList) {
      const s = normalizeStation(raw);
      next.set(s.id, s);
    }

    // 站點清單變化檢測（新增/移除站點）
    const listChanged = next.size !== this.state.stations.size;

    this.state = { ...this.state, stations: next };

    if (listChanged) {
      this.stationIdsCached = Array.from(next.keys());
      this.emit('stations');
    }

    this.reconcile();
  }

  /** 陰影更新 — 每 15 分鐘 */
  updateShadeLayer(shade: ShadeSnapshot): void {
    // 重建空間索引 — 只在陰影更新時
    this.spatialIndex = new ShadeGridSpatialIndex(shade);
    this.state = { ...this.state, activeShade: shade };
    this.emit('shade');
    this.reconcile();
  }

  /** 更新選中站點 */
  selectStation(id: string | null): void {
    if (this.state.selectedStation === id) return;
    this.state = { ...this.state, selectedStation: id };
  }

  // ═══════════ 合併 + Diff + 精準通知 ═══════════

  private reconcile(): void {
    const { nextViewModels, changedIds } = mergeStationShade(
      this.state.stations,
      this.state.activeShade,
      this.state.viewModels,
      this.spatialIndex,
    );

    if (changedIds.size === 0) return; // ⚡ 零變化 = 零通知

    this.state = {
      ...this.state,
      viewModels: nextViewModels,
      changedIds,
    };

    // 通知全域頻道（供 MapLibre sync hook）
    this.emit('viewmodels');

    // 通知個別站點頻道（供 React Marker 元件）
    for (const id of changedIds) {
      this.emit(`station:${id}`);
    }
  }

  // ═══════════ Pub/Sub ═══════════

  subscribe(channel: Channel, listener: Listener): () => void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(listener);

    // 回傳 unsubscribe 函數
    return () => {
      this.listeners.get(channel)?.delete(listener);
    };
  }

  /** useSyncExternalStore 專用 — 訂閱單一站點 */
  subscribeStation(id: string, cb: Listener): () => void {
    return this.subscribe(`station:${id}`, cb);
  }

  private emit(channel: Channel): void {
    const channelListeners = this.listeners.get(channel);
    if (channelListeners) {
      for (const fn of channelListeners) {
        fn();
      }
    }
  }
}

// ═══════════ 初始狀態工廠 ═══════════

function createInitialState(): AppState {
  return {
    stations: new Map(),
    activeShade: null,
    shadowWindow: null,
    viewModels: new Map(),
    changedIds: new Set(),
    selectedStation: null,
    viewport: {
      center: [121.5654, 25.0330] as const,
      zoom: 13,
      bounds: null,
    },
    timeSlider: {
      currentTime: Date.now(),
      isPlaying: false,
    },
    visibility: {
      isVisible: true,
      hiddenSince: null,
    },
    sync: {
      lastBikeFetch: 0,
      lastShadeFetch: 0,
      bikeFetchInterval: 60_000,
      shadeFetchInterval: 900_000,
    },
  };
}
