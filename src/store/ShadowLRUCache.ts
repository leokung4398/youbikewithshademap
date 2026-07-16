// ═══════════════════════════════════════════════════════
//  store/ShadowLRUCache.ts — 3-Slot 滾動式 LRU Cache
//
//  ADR #4: 記憶體內永遠只保留 3 份 GeoJSON
//  (前一區塊、當前區塊、下一區塊)，避免 OOM。
//
//  實作：利用 JavaScript Map 的插入順序特性，
//  最舊的 entry 總是 Map iterator 的第一個。
// ═══════════════════════════════════════════════════════

import type { ShadeSnapshot, ShadeSlotKey, ShadowCacheWindow } from '../types/shadow';
import { getAdjacentSlots } from '../core/shadeTimeSlot';

const MAX_SLOTS = 3;

export class ShadowLRUCache {
  private readonly cache = new Map<ShadeSlotKey, ShadeSnapshot>();
  private currentSlot: ShadeSlotKey | null = null;

  /**
   * 取得快取中的 snapshot。
   * 存取時自動刷新 LRU 順序（刪除再重新插入）。
   */
  get(key: ShadeSlotKey): ShadeSnapshot | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 刷新 LRU 順序
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry;
  }

  /**
   * 寫入一個 snapshot。
   * 若超過 MAX_SLOTS 個，驅逐最久未存取的（Map 的第一個 key）。
   */
  set(key: ShadeSlotKey, snapshot: ShadeSnapshot): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= MAX_SLOTS) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, snapshot);
  }

  /** 判斷指定 key 是否已在快取中 */
  has(key: ShadeSlotKey): boolean {
    return this.cache.has(key);
  }

  /**
   * 滑動窗口 — 當時間推進到新的 15 分鐘區塊時呼叫。
   * 回傳新的窗口狀態 + 需要 fetch 的 keys。
   */
  advanceTo(newSlotKey: ShadeSlotKey): {
    window: ShadowCacheWindow;
    needsFetch: ShadeSlotKey[];
  } {
    this.currentSlot = newSlotKey;
    const { prev, next } = getAdjacentSlots(newSlotKey);

    const window: ShadowCacheWindow = { prev, current: newSlotKey, next };

    const needsFetch: ShadeSlotKey[] = [];
    const candidates = [prev, newSlotKey, next];
    for (const key of candidates) {
      if (key !== null && !this.cache.has(key)) {
        needsFetch.push(key);
      }
    }

    return { window, needsFetch };
  }

  /** 取得當前窗口狀態（供 DevTools 除錯） */
  getWindowState(): ShadowCacheWindow | null {
    if (!this.currentSlot) return null;
    const { prev, next } = getAdjacentSlots(this.currentSlot);
    return { prev, current: this.currentSlot, next };
  }

  /** 當前快取大小 */
  get size(): number {
    return this.cache.size;
  }

  /** 清空快取 */
  clear(): void {
    this.cache.clear();
    this.currentSlot = null;
  }
}
