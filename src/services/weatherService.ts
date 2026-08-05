import type { AppStore } from '../store/AppStore';

export function updateWeatherByHour(store: AppStore, hour: number) {
  // 簡易的天氣模擬邏輯，與時間連動以展示即時警報
  let temperature = 25;
  let feelsLike = 26;
  let uvIndex = 0;

  if (hour >= 8 && hour <= 10) {
    // 清晨到上午
    temperature = 28 + (hour - 8);
    feelsLike = temperature + 2;
    uvIndex = 3 + (hour - 8) * 1.5;
  } else if (hour >= 11 && hour <= 14) {
    // 中午危險級 (12:00 ~ 13:00 最高)
    temperature = 33 + (hour === 12 || hour === 13 ? 2 : 0);
    feelsLike = temperature + 4;
    uvIndex = 8 + (hour === 12 || hour === 13 ? 2 : 0);
  } else if (hour >= 15 && hour <= 17) {
    // 下午
    temperature = 32 - (hour - 15);
    feelsLike = temperature + 2;
    uvIndex = 5 - (hour - 15) * 1.5;
  }

  const isDanger = uvIndex >= 8 || feelsLike >= 35;

  store.setWeather({
    temperature: Math.round(temperature),
    feelsLike: Math.round(feelsLike),
    uvIndex: Math.round(uvIndex * 10) / 10,
    isDanger
  });
}
