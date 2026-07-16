import os
import json
import math
import random
import datetime
import h3
import geopandas as gpd
from shapely.geometry import Polygon

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

def calculate_shade(h3_index):
    cell_to_latlng = getattr(h3, 'cell_to_latlng', getattr(h3, 'h3_to_geo', None))
    lat, lon = cell_to_latlng(h3_index)
    
    try:
        import suncalc
        # 為了展示效果，強制設定為白天 (上午 10 點) 才有陰影可看
        date = datetime.datetime(2026, 6, 26, 10, 0, 0)
        pos = suncalc.get_position(date, lon, lat)
        altitude = pos['altitude']
    except Exception:
        altitude = math.radians(60)

    # h = object height
    h = 20.0 + (hash(h3_index) % 30)
    
    tan_theta = math.tan(altitude)
    L = h / tan_theta if tan_theta > 0.001 else 0
    
    shade_coverage = min(max(L / 50.0, 0.0), 1.0)
    # inShadow threshold
    in_shadow = shade_coverage > 0.3
    return in_shadow, shade_coverage

def generate_shade_geojson(output_dir):
    hexes = get_h3_indices(9)
    features = []
    to_boundary = getattr(h3, 'cell_to_boundary', getattr(h3, 'h3_to_geo_boundary', None))
    
    for h_index in hexes:
        in_shadow, intensity = calculate_shade(h_index)
        boundary = to_boundary(h_index)
        
        # H3 returns (lat, lon), GeoJSON expects (lon, lat)
        boundary_lonlat = [(lng, lt) for lt, lng in boundary]
        boundary_lonlat.append(boundary_lonlat[0]) # close polygon
        
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
    
    shade_dir = os.path.join(output_dir, "cdn", "shade")
    os.makedirs(shade_dir, exist_ok=True)
    output_file = os.path.join(shade_dir, "shade_taipei_1000.geojson") # Using taipei_1000 to match frontend default logic if needed, though frontend fetches based on time. We will output shade_taipei_1000.geojson and others.
    
    # Generate for the current timeslot
    now = datetime.datetime.now()
    slot_min = (now.minute // 15) * 15
    slot_key = f"taipei_{now.hour:02d}{slot_min:02d}"
    output_file = os.path.join(shade_dir, f"shade_{slot_key}.geojson")

    # Also output a default one so it always works on initial load if time differs
    default_file = os.path.join(shade_dir, f"shade_taipei_1000.geojson")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(feature_collection, f, ensure_ascii=False)
    with open(default_file, 'w', encoding='utf-8') as f:
        json.dump(feature_collection, f, ensure_ascii=False)
        
    print(f"Generated {len(hexes)} hexes and saved to {output_file}")

def generate_mock_stations(output_dir):
    stations = []
    for i in range(1, 101):
        lat = LAT_MIN + random.random() * (LAT_MAX - LAT_MIN)
        lng = LON_MIN + random.random() * (LON_MAX - LON_MIN)
        total = random.randint(15, 44)
        
        sbi = random.randint(0, total)
        bemp = total - sbi
        
        # 10% extremes
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
