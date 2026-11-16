# User Documentation Theme Configuration

The Sphinx user documentation supports theme-specific navigation logos and CSS styling. Set `VITE_THEME` in `docs/.env` to select a theme when building the user documentation. This is separate from the application UI theme described in [FAIMS3 Configuration](../Configuration.md).

## Theme configuration

User documentation themes are configured in `docs/user/conf.py`:

```python
THEME_NAME = os.getenv("VITE_THEME", "default")

THEME_CONFIG = {
    "default": {
        "logo": "img/default-logo.png",
        "css": ["css/custom.css"],
    },
    "fieldmark": {
        "logo": "img/fieldmark-logo.png",
        "css": ["css/custom.css"],
    },
    "bssTheme": {
        "logo": "img/bssTheme-logo.png",
        "css": ["css/bss-custom.css"],
    },
}

# Use the default theme configuration if the theme is not recognised.
theme_config = THEME_CONFIG.get(THEME_NAME, THEME_CONFIG["default"])

# Warn if the theme logo has not been copied from the app.
logo_path = Path(__file__).parent / "_static" / theme_config["logo"]
if not logo_path.is_file():
    print(f"Warning: Documentation logo not found: {logo_path}")

html_css_files = theme_config["css"]
```

The navbar logo is selected in `html_theme_options` using `logo=theme_config["logo"]`.

| `VITE_THEME` | Navbar logo              | CSS                  |
| ------------ | ------------------------ | -------------------- |
| `default`    | `img/default-logo.png`   | `css/custom.css`     |
| `fieldmark`  | `img/fieldmark-logo.png` | `css/custom.css`     |
| `bssTheme`   | `img/bssTheme-logo.png`  | `css/bss-custom.css` |

The paths above are relative to `docs/user/_static/`. Theme-specific CSS files live in `_static/css/`. Logos are copied into `_static/img/` from the app's theme assets during `app/bin/preBuildConfig.sh`:

```text
app/public/base-assets/<theme>/logo.png
    → docs/user/_static/img/<theme>-logo.png
```

For example, `app/public/base-assets/bssTheme/logo.png` is copied as `docs/user/_static/img/bssTheme-logo.png`.

An unrecognised theme name uses the `default` logo and CSS configuration. If a configured logo file is missing, the Sphinx configuration prints a warning, it does not automatically switch to a different logo.

## Adding a theme

1. Add the logo at `app/public/base-assets/<theme>/logo.png` and, if needed, a stylesheet under `docs/user/_static/css/`.
2. Add an entry to `THEME_CONFIG` in `docs/user/conf.py`:

   ```python
   "newTheme": {
       "logo": "img/newTheme-logo.png",
       "css": ["css/new-custom.css"],
   },
   ```

3. Run the app pre-build process to copy the logo, then set `VITE_THEME=newTheme` and rebuild the user documentation. Ensure the environment variable is passed into the Sphinx Docker build if applicable.

Logo dimensions (`logo_height` and `logo_width`) are currently shared by all themes in `html_theme_options`.
