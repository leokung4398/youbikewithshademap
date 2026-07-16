import os
import json
import math
import datetime
import h3
import geopandas as gpd
from shapely.geometry import Polygon

# Target area: Taichung Xitun District
# Bounding Box: lat 24.14~24.18, lon 120.61~120.66
lat_min, lat_max = 24.14, 24.18
lon_min, lon_max = 120.61, 120.66

def get_h3_indices(resolution=10):
    hexes = set()
    lat_step = 0.0005
    lon_step = 0.0005
    
    # Handle API differences between h3 v3 and v4
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

def calculate_shade(h3_index):
    # Get lat, lon of the hex center
    cell_to_latlng = getattr(h3, 'cell_to_latlng', getattr(h3, 'h3_to_geo', None))
    lat, lon = cell_to_latlng(h3_index)
    
    try:
        import suncalc
        # Time: Summer solstice around 10:00 AM local time
        date = datetime.datetime(2026, 6, 26, 10, 0, 0)
        pos = suncalc.get_position(date, lon, lat)
        altitude = pos['altitude']
    except Exception:
        # Fallback to roughly 60 degrees if suncalc fails
        altitude = math.radians(60)

    # h = object height (randomly assigned based on hash for variance)
    h = 20.0 + (hash(h3_index) % 30)
    
    # L = h / tan(θ)
    tan_theta = math.tan(altitude)
    if tan_theta > 0.001:
        L = h / tan_theta
    else:
        L = 0
    
    # Calculate coverage heuristic
    shade_coverage = min(max(L / 50.0, 0.0), 1.0)
    return shade_coverage

def main():
    hexes = get_h3_indices(10)
    features = []
    to_boundary = getattr(h3, 'cell_to_boundary', getattr(h3, 'h3_to_geo_boundary', None))
    
    for h_index in hexes:
        shade = calculate_shade(h_index)
        boundary = to_boundary(h_index)
        
        # H3 returns (lat, lon) pairs, Shapely expects (lon, lat)
        boundary_lonlat = [(lng, lt) for lt, lng in boundary]
        
        polygon = Polygon(boundary_lonlat)
        
        features.append({
            "type": "Feature",
            "properties": {
                "h3_index": h_index,
                "shade_coverage": round(shade, 3)
            },
            "geometry": polygon.__geo_interface__
        })
        
    feature_collection = {
        "type": "FeatureCollection",
        "features": features
    }
    
    output_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "public", "cdn", "shade"))
    os.makedirs(output_dir, exist_ok=True)
    
    output_file = os.path.join(output_dir, "shade_taichung_xitun_1000.geojson")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(feature_collection, f, ensure_ascii=False)
        
    print(f"Generated {len(hexes)} hexes and saved to {output_file}")

if __name__ == "__main__":
    main()
