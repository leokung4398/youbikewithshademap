irm https://astral.sh/uv/install.ps1 | iex
$env:Path = "$env:USERPROFILE\.local\bin;" + $env:Path
uv run --with suncalc --with geopandas --with h3 --with shapely python backend\generate_shade_layer.py
