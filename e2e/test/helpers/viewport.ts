/**
 * Shared viewport sizes and apply helpers for consistent, unstretched screenshots.
 */
import {browser} from '@wdio/globals';

/** Common viewport sizes for testing (VIEWPORT env selects one of these). */
export const VIEWPORTS = {
  mobile: {width: 430, height: 932}, // iPhone 14 Pro Max
  tablet: {width: 1024, height: 768}, // iPad
  desktop: {width: 1440, height: 900}, // Typical laptop CSS viewport (16:10)
  wide: {width: 1920, height: 1080}, // Full HD
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export type ViewportConfig = {
  width: number;
  height: number;
  name: string;
};

type CdpBrowser = WebdriverIO.Browser & {
  sendCommandAndGetResult?: (
    cmd: string,
    params: Record<string, unknown>
  ) => Promise<unknown>;
};

/**
 * Get viewport configuration from environment.
 *
 * Prefers SCREEN_WIDTH + SCREEN_HEIGHT when both are set; otherwise uses
 * VIEWPORT (mobile|tablet|desktop|wide), defaulting to desktop.
 */
export function getViewportConfig(): ViewportConfig {
  const viewportName = process.env.VIEWPORT || 'desktop';
  const customWidth = process.env.SCREEN_WIDTH;
  const customHeight = process.env.SCREEN_HEIGHT;

  // Use custom dimensions if provided
  if (customWidth && customHeight) {
    return {
      width: parseInt(customWidth, 10),
      height: parseInt(customHeight, 10),
      name: 'custom',
    };
  }

  // Use predefined viewport
  const viewport = VIEWPORTS[viewportName as ViewportName];
  if (!viewport) {
    console.warn(`Unknown viewport: ${viewportName}, using desktop`);
    return {...VIEWPORTS.desktop, name: 'desktop'};
  }

  return {...viewport, name: viewportName};
}

/**
 * Chrome launch args that lock CSS pixels to device pixels (avoids stretched shots).
 */
export function chromeViewportArgs(viewport = getViewportConfig()): string[] {
  return [
    `--window-size=${viewport.width},${viewport.height}`,
    '--force-device-scale-factor=1',
    '--high-dpi-support=1',
  ];
}

async function applyViaCdp(width: number, height: number): Promise<boolean> {
  const driver = browser as CdpBrowser;
  if (typeof driver.sendCommandAndGetResult !== 'function') {
    return false;
  }
  await driver.sendCommandAndGetResult('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return true;
}

/**
 * Apply the configured viewport so screenshots match CSS layout 1:1.
 *
 * Order:
 * 1. BiDi setViewport (headed / non-Classic)
 * 2. Chrome CDP Emulation.setDeviceMetricsOverride (Classic headless)
 * 3. setWindowSize fallback
 */
export async function applyViewport(
  viewport = getViewportConfig()
): Promise<ViewportConfig> {
  const {width, height, name} = viewport;
  console.log(
    `Applying viewport ${width}x${height} (${name}), devicePixelRatio=1`
  );

  try {
    await browser.setViewport({
      width,
      height,
      devicePixelRatio: 1,
    });
    return viewport;
  } catch {
    // Classic WebDriver has no BiDi session — expected for headless caps.
  }

  try {
    if (await applyViaCdp(width, height)) {
      return viewport;
    }
  } catch (err) {
    console.warn(
      'CDP Emulation.setDeviceMetricsOverride failed:',
      err instanceof Error ? err.message : err
    );
  }

  await browser.setWindowSize(width, height);
  return viewport;
}
