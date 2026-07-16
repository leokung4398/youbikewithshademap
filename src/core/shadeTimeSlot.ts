// ═══════════════════════════════════════════════════════
//  core/shadeTimeSlot.ts — 15 分鐘時段計算工具
// ═══════════════════════════════════════════════════════

import type { ShadeSlotKey } from '../types/shadow';

const SLOT_MINUTES = 15;
const CITY_PREFIX = 'taipei';

/** 將 Unix ms 對齊到最近的 15 分鐘 floor */
export function timestampToSlotKey(timestamp: number): ShadeSlotKey {
  const d = new Date(timestamp);
  const h = d.getHours();
  const m = Math.floor(d.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES;
  return `${CITY_PREFIX}_${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}

/** 將 slot key 轉換為 CDN URL */
export function slotKeyToCdnUrl(key: ShadeSlotKey): string {
  return import.meta.env.BASE_URL + `cdn/shade/shade_${key}.geojson`;
}

/** 取得前後相鄰的 slot key */
export function getAdjacentSlots(key: ShadeSlotKey): {
  prev: ShadeSlotKey | null;
  next: ShadeSlotKey | null;
} {
  const match = key.match(/^(.+)_(\d{2})(\d{2})$/);
  if (!match) return { prev: null, next: null };

  const [, prefix, hStr, mStr] = match;
  const totalMinutes = parseInt(hStr!, 10) * 60 + parseInt(mStr!, 10);

  const prevMin = totalMinutes - SLOT_MINUTES;
  const nextMin = totalMinutes + SLOT_MINUTES;

  return {
    prev: prevMin >= 0 ? `${prefix!}_${formatMinutes(prevMin)}` : null,
    next: nextMin < 24 * 60 ? `${prefix!}_${formatMinutes(nextMin)}` : null,
  };
}

/** 總分鐘數 → "HHMM" 格式 */
function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}${String(m).padStart(2, '0')}`;
}
