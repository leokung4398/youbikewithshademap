import { AppStore } from '../store/AppStore';
import type { ShadeRoute } from '../types/state';

export async function fetchShadeRoutes(store: AppStore): Promise<void> {
  const { startLocation, endLocation } = store.getState().routing;
  if (!startLocation?.coord || !endLocation?.coord) return;

  store.setRoutingLoading(true);

  try {
    const start = startLocation.coord;
    const end = endLocation.coord;
    const url = `https://router.project-osrm.org/route/v1/bicycle/${start[0]},${start[1]};${end[0]},${end[1]}?overview=full&geometries=geojson&alternatives=true`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.code !== 'Ok') {
      throw new Error(data.message || 'Routing failed');
    }

    const routes: ShadeRoute[] = data.routes.map((r: any, idx: number) => {
      const geometry = r.geometry as GeoJSON.LineString;
      const coords = geometry.coordinates;
      
      let pointsInShade = 0;
      // 在前端將路徑上每一個節點跟當前 H3 陰影網格比對
      for (const coord of coords) {
        if (store.isPointInShadow(coord as [number, number])) {
          pointsInShade++;
        }
      }

      const totalPoints = coords.length;
      const shadeScore = totalPoints > 0 ? pointsInShade / totalPoints : 0;

      return {
        id: `route_${idx}`,
        geometry,
        distance: r.distance,
        duration: r.duration,
        shadeScore
      };
    });

    // 依陰影覆蓋率排序，最高的 (最涼爽) 排第一
    routes.sort((a, b) => b.shadeScore - a.shadeScore);

    const bestRouteId = routes.length > 0 ? routes[0].id : null;
    store.setRoutingResult(routes, bestRouteId);

  } catch (err) {
    console.error('Error fetching routes:', err);
    store.setRoutingResult([], null);
  }
}
