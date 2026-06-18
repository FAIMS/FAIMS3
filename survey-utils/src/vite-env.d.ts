/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_THEME?: 'default' | 'bssTheme' | 'fieldmark';
  readonly VITE_MAP_SOURCE?: string;
  readonly VITE_MAP_SOURCE_KEY?: string;
  readonly VITE_MAP_STYLE?: 'basic' | 'openstreetmap' | 'osm-bright' | 'toner';
  readonly VITE_SATELLITE_SOURCE?: 'esri' | 'maptiler';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
