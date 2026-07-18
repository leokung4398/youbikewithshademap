import os
import json
import math
import random
import datetime
import h3
import urllib.request

# 1. 抓取台北市真實 YouBike 2.0 API 資料
def fetch_real_stations():
    url = 'https://tcgbusfs.blob.core.windows.net/dotapp/youbike/v2/youbike_immediate.json'
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode('utf-8'))
            # 嚴格過濾出「松山區」的站點
            songshan_stations = [s for s in data if s.get('sarea') == '松山區']
            return songshan_stations
    except Exception as e:
        print(f"Failed to fetch real data: {e}")
        return []

# 2. 根據自動計算出的 Bounding Box 產生 H3 網格
def get_h3_indices(lat_min, lat_max, lon_min, lon_max, resolution=9):
    hexes = set()
    lat_step = 0.002
    lon_step = 0.002
    
    to_cell = getattr(h3, 'latlng_to_cell', getattr(h3, 'geo_to_h3', None))
    
    lat = lat_min
    while lat <= lat_max:
        lon = lon_min
        while lon <= lon_max:
            if to_cell:
                hexes.add(to_cell(lat, lon, resolution))
            lon += lon_step
        lat += lat_step
    return list(hexes)

# 3. 產生 08:00 ~ 17:00 的陰影資料
def generate_shade_geojson(output_dir, hexes):
    to_boundary = getattr(h3, 'cell_to_boundary', getattr(h3, 'h3_to_geo_boundary', None))
    shade_dir = os.path.join(output_dir, "cdn", "shade")
    os.makedirs(shade_dir, exist_ok=True)
    
    for hour in range(8, 18):
        features = []
        # 設定台灣時區
        tz = datetime.timezone(datetime.timedelta(hours=8))
        date = datetime.datetime(2026, 6, 26, hour, 0, 0, tzinfo=tz)
        
        for h_index in hexes:
            cell_to_latlng = getattr(h3, 'cell_to_latlng', getattr(h3, 'h3_to_geo', None))
            lat, lon = cell_to_latlng(h_index)
            
            try:
                import suncalc
                pos = suncalc.get_position(date, lon, lat)
                altitude = pos['altitude']
            except Exception:
                altitude = math.radians(60)

            boundary = to_boundary(h_index)
            boundary_lonlat = [(lng, lt) for lt, lng in boundary]
            boundary_lonlat.append(boundary_lonlat[0])
            
            shade_coverage = 0
            if altitude > 0.1:
                density = (math.sin(lat * 5000) * math.cos(lon * 5000) + 1) / 2
                random.seed(f"{lat}_{lon}_{hour}")
                shade_coverage = density * 0.6 + random.random() * 0.4
                
            in_shadow = shade_coverage > 0.75
            intensity = shade_coverage if in_shadow else 0
            
            features.append({
                "type": "Feature",
                "properties": {
                    "cellId": h_index,
                    "inShadow": in_shadow,
                    "shadowIntensity": round(intensity, 3)
                },
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [boundary_lonlat]
                }
            })
            
        feature_collection = {
            "type": "FeatureCollection",
            "features": features
        }
        
        output_file = os.path.join(shade_dir, f"shade_taipei_{hour:02d}00.geojson")
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(feature_collection, f, ensure_ascii=False)
            
        print(f"Generated {len(hexes)} hexes for {hour:02d}:00 and saved to {output_file}")
        
    import shutil
    shutil.copy(os.path.join(shade_dir, "shade_taipei_1000.geojson"), 
                os.path.join(shade_dir, "shade_taipei_default.geojson"))

def main():
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))
    os.makedirs(output_dir, exist_ok=True)
    
    # 執行流程：抓資料 -> 算範圍 -> 產生陰影 -> 存檔
    stations = fetch_real_stations()
    if not stations:
        print("No stations found or API failed.")
        return
        
    # 計算松山區站點的邊界 (Bounding Box)，並往外擴充一點點 (0.005) 讓地圖的陰影網格更完整
    lats = [s['lat'] for s in stations]
    lngs = [s['lng'] for s in stations]
    lat_min, lat_max = min(lats) - 0.005, max(lats) + 0.005
    lon_min, lon_max = min(lngs) - 0.005, max(lngs) + 0.005
    
    print("Songshan District Bounding Box:")
    print(f"Lat: {lat_min} ~ {lat_max}")
    print(f"Lon: {lon_min} ~ {lon_max}")
    
    hexes = get_h3_indices(lat_min, lat_max, lon_min, lon_max, resolution=9)
    generate_shade_geojson(output_dir, hexes)
    
    # 將真實資料寫入 mock_stations.json (因為前端是讀取這個檔名，我們不改檔名可以省下修改前端的麻煩)
    output_file = os.path.join(output_dir, "mock_stations.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    print(f"Generated {len(stations)} real stations to {output_file}")

if __name__ == "__main__":
    main()
