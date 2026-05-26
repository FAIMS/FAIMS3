/// <reference types="vite/client" />

// Vite define replacements
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Theme name aligned with app: `default` | `fieldmark` | `bssTheme` */
  readonly VITE_THEME?: string;
  /** Legacy web theme env; used as fallback when VITE_THEME is unset */
  readonly VITE_APP_THEME?: string;
  /** `allow` | `never` — mobile app directory cleanup; optional, defaults to never */
  readonly VITE_FORCE_REMOTE_DELETION?: string;
  /** When true, app wipes local Pouch on manual deactivate; optional, defaults to false */
  readonly VITE_DELETE_ON_DEACTIVATION?: string;
}
