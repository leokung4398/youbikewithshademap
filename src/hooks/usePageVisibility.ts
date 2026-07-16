// ═══════════════════════════════════════════════════════
//  hooks/usePageVisibility.ts — 省電核心
//
//  ADR #3: Page Visibility API 整合
//  - 進入背景：立即暫停所有 API Polling 與地圖重繪
//  - 返回前景：
//    - 休眠 ≥ 5min → 全局資料重拉
//    - 休眠 < 5min → 僅拉當前 Bounding Box 內的更新
// ═══════════════════════════════════════════════════════

import { useEffect, useRef, useCallback } from 'react';

/** 5 分鐘門檻 (ms) */
const STALE_THRESHOLD = 5 * 60 * 1000;

/** 喚醒策略 */
export type WakeStrategy =
  | { readonly type: 'full-reload' }
  | { readonly type: 'incremental'; readonly bounds: [number, number, number, number] }
  | { readonly type: 'noop' };

export interface UsePageVisibilityOptions {
  /** 進入背景時觸發 — 暫停所有 timer */
  onSleep: () => void;
  /** 返回前景時觸發 — 依策略恢復 */
  onWake: (strategy: WakeStrategy) => void;
  /** 取得當前地圖 Bounding Box [west, south, east, north] */
  getMapBounds: () => [number, number, number, number] | null;
}

/**
 * Custom Hook: 監聽頁面可見性變化
 *
 * 使用 document.visibilityState (非 deprecated 的 document.hidden)
 * SSR 安全：初始化時檢查 document 是否存在
 */
export function usePageVisibility({
  onSleep,
  onWake,
  getMapBounds,
}: UsePageVisibilityOptions): void {
  const hiddenAtRef = useRef<number | null>(null);

  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'hidden') {
      // ── 進入背景 ──
      hiddenAtRef.current = Date.now();
      onSleep();
    } else {
      // ── 返回前景 ──
      const hiddenAt = hiddenAtRef.current;
      hiddenAtRef.current = null;

      if (hiddenAt === null) {
        onWake({ type: 'noop' });
        return;
      }

      const sleepDuration = Date.now() - hiddenAt;

      if (sleepDuration >= STALE_THRESHOLD) {
        // 休眠超過 5 分鐘 → 全局重拉
        // 陰影可能已跨時段，車輛數肯定已過期
        onWake({ type: 'full-reload' });
      } else {
        // 短暫離開 → 只拉當前視野內的更新
        const bounds = getMapBounds();
        if (bounds) {
          onWake({ type: 'incremental', bounds });
        } else {
          // 無法取得 bounds 則 fallback 到全量
          onWake({ type: 'full-reload' });
        }
      }
    }
  }, [onSleep, onWake, getMapBounds]);

  useEffect(() => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleVisibilityChange]);
}
