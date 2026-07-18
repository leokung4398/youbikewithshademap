import os
import json
import math
import random
import datetime
import h3

# Target area: Taichung Xitun District
# Bounding Box: lat 24.14~24.18, lon 120.61~120.66
LAT_MIN, LAT_MAX = 24.14, 24.18
LON_MIN, LON_MAX = 120.61, 120.66

def get_h3_indices(resolution=9):
    hexes = set()
    lat_step = 0.002
    lon_step = 0.002
    
    to_cell = getattr(h3, 'latlng_to_cell', getattr(h3, 'geo_to_h3', None))
    
    lat = LAT_MIN
    while lat <= LAT_MAX:
        lon = LON_MIN
        while lon <= LON_MAX:
            if to_cell:
                hexes.add(to_cell(lat, lon, resolution))
            lon += lon_step
        lat += lat_step
    return list(hexes)

def generate_shade_geojson(output_dir):
    hexes = get_h3_indices(9)
    to_boundary = getattr(h3, 'cell_to_boundary', getattr(h3, 'h3_to_geo_boundary', None))
    
    shade_dir = os.path.join(output_dir, "cdn", "shade")
    os.makedirs(shade_dir, exist_ok=True)
    
    # 迴圈產生早上 8 點到下午 5 點 (8~17) 的陰影資料
    for hour in range(8, 18):
        features = []
        # 設定每個小時的確切時間，並且加上「台灣時區 (UTC+8)」！
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
            boundary_lonlat.append(boundary_lonlat[0]) # close polygon
            
            shade_coverage = 0
            # 只有當太陽在地平線上 (altitude > 0) 且建築密集度夠高時，才會有陰影
            if altitude > 0.1: # 稍微提高門檻，避免清晨黃昏陰影過大
                density = (math.sin(lat * 5000) * math.cos(lon * 5000) + 1) / 2
                random.seed(f"{lat}_{lon}_{hour}") # 確保同一小時的陰影固定，不同小時會略有變化
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
        
    # 預設複製一份 10 點的作為 initial load
    import shutil
    shutil.copy(os.path.join(shade_dir, "shade_taipei_1000.geojson"), 
                os.path.join(shade_dir, "shade_taipei_default.geojson"))

def generate_mock_stations(output_dir):
    stations = []
    for i in range(1, 101):
        lat = LAT_MIN + random.random() * (LAT_MAX - LAT_MIN)
        lng = LON_MIN + random.random() * (LON_MAX - LON_MIN)
        total = random.randint(15, 44)
        
        sbi = random.randint(0, total)
        bemp = total - sbi
        
        rand_val = random.random()
        if rand_val < 0.05:
            sbi, bemp = 0, total
        elif rand_val < 0.1:
            sbi, bemp = total, 0

        stations.append({
            "sno": f"5001{i:03d}",
            "sna": f"YouBike2.0_西屯測試站{i}",
            "snaen": f"Xitun Test Station {i}",
            "sarea": "西屯區",
            "sareaen": "Xitun Dist.",
            "lat": lat,
            "lng": lng,
            "ar": "模擬地址",
            "aren": "Mock Address",
            "tot": total,
            "sbi": sbi,
            "bemp": bemp,
            "act": 1,
            "mday": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

    output_file = os.path.join(output_dir, "mock_stations.json")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(stations, f, ensure_ascii=False, indent=2)
    print(f"Generated 100 mock stations to {output_file}")

def main():
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public"))
    os.makedirs(output_dir, exist_ok=True)
    
    generate_shade_geojson(output_dir)
    generate_mock_stations(output_dir)

if __name__ == "__main__":
    main()
