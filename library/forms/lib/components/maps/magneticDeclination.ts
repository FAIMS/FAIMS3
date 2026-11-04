// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   World Magnetic Model 2025 declination (east-positive degrees).
 *
 *   Terms
 *     True (geographic) north — direction along a meridian toward the
 *       geographic North Pole. OSM / OpenLayers (EPSG:3857) are drawn
 *       this way. iOS Capgo already reports heading relative to this.
 *     Magnetic north — direction a magnetometer / compass needle points.
 *       Android Capgo and web DeviceOrientation report this.
 *     Declination — signed angle from true north to magnetic north.
 *       East is positive. trueHeading = magneticHeading + declination.
 *
 *   Why this file exists
 *     The map is true-north. Android/web compass readings are magnetic,
 *     so they are off the map grid by the local declination (often 10°+
 *     in Australia) until this correction is applied.
 *
 *   Source
 *     Ported from NOAA GeoMag (Quinn / Maus / Nair) as packaged in:
 *       https://github.com/wiedehopf/readsb/blob/dev/geomag.c
 *     Model overview / official WMM software:
 *       https://www.ncei.noaa.gov/products/world-magnetic-model
 *       https://www.ngdc.noaa.gov/geomag/WMM/soft.shtml
 *     Coefficients: NOAA / NCEI WMM-2025, epoch 2025.0 (valid 2025–2029).
 *       https://www.ncei.noaa.gov/products/world-magnetic-model/wmm-coefficients
 *     Do not fetch a network model — field devices are often offline.
 *
 *   NOAA's coefficient layout is easy to get wrong:
 *     c[m][n]     = g_nm,   cd[m][n]     = ġ_nm
 *     c[n][m-1]   = h_nm,   cd[n][m-1]   = ḣ_nm   (m ≠ 0)
 *   Schmidt factors live in a 1-D `snorm` indexed as `n + m * SIZE`.
 *   Tested against official WMM2025_TEST_VALUES.txt vectors.
 */

const MAX_ORD = 12;
const SIZE = MAX_ORD + 1;
const WMM_EPOCH = 2025.0;
/** WGS84 semi-major / semi-minor axes (km). */
const WGS84_A = 6378.137;
const WGS84_B = 6356.7523142;
/** Geomagnetic reference radius used by WMM (km). */
const EARTH_RADIUS_KM = 6371.2;

/** Gauss coefficients: [n, m, g, h, gDot, hDot] at epoch 2025.0. */
const WMM2025: ReadonlyArray<
  readonly [number, number, number, number, number, number]
> = [
  [1, 0, -29351.8, 0.0, 12.0, 0.0],
  [1, 1, -1410.8, 4545.4, 9.7, -21.5],
  [2, 0, -2556.6, 0.0, -11.6, 0.0],
  [2, 1, 2951.1, -3133.6, -5.2, -27.7],
  [2, 2, 1649.3, -815.1, -8.0, -12.1],
  [3, 0, 1361.0, 0.0, -1.3, 0.0],
  [3, 1, -2404.1, -56.6, -4.2, 4.0],
  [3, 2, 1243.8, 237.5, 0.4, -0.3],
  [3, 3, 453.6, -549.5, -15.6, -4.1],
  [4, 0, 895.0, 0.0, -1.6, 0.0],
  [4, 1, 799.5, 278.6, -2.4, -1.1],
  [4, 2, 55.7, -133.9, -6.0, 4.1],
  [4, 3, -281.1, 212.0, 5.6, 1.6],
  [4, 4, 12.1, -375.6, -7.0, -4.4],
  [5, 0, -233.2, 0.0, 0.6, 0.0],
  [5, 1, 368.9, 45.4, 1.4, -0.5],
  [5, 2, 187.2, 220.2, 0.0, 2.2],
  [5, 3, -138.7, -122.9, 0.6, 0.4],
  [5, 4, -142.0, 43.0, 2.2, 1.7],
  [5, 5, 20.9, 106.1, 0.9, 1.9],
  [6, 0, 64.4, 0.0, -0.2, 0.0],
  [6, 1, 63.8, -18.4, -0.4, 0.3],
  [6, 2, 76.9, 16.8, 0.9, -1.6],
  [6, 3, -115.7, 48.8, 1.2, -0.4],
  [6, 4, -40.9, -59.8, -0.9, 0.9],
  [6, 5, 14.9, 10.9, 0.3, 0.7],
  [6, 6, -60.7, 72.7, 0.9, 0.9],
  [7, 0, 79.5, 0.0, -0.0, 0.0],
  [7, 1, -77.0, -48.9, -0.1, 0.6],
  [7, 2, -8.8, -14.4, -0.1, 0.5],
  [7, 3, 59.3, -1.0, 0.5, -0.8],
  [7, 4, 15.8, 23.4, -0.1, 0.0],
  [7, 5, 2.5, -7.4, -0.8, -1.0],
  [7, 6, -11.1, -25.1, -0.8, 0.6],
  [7, 7, 14.2, -2.3, 0.8, -0.2],
  [8, 0, 23.2, 0.0, -0.1, 0.0],
  [8, 1, 10.8, 7.1, 0.2, -0.2],
  [8, 2, -17.5, -12.6, 0.0, 0.5],
  [8, 3, 2.0, 11.4, 0.5, -0.4],
  [8, 4, -21.7, -9.7, -0.1, 0.4],
  [8, 5, 16.9, 12.7, 0.3, -0.5],
  [8, 6, 15.0, 0.7, 0.2, -0.6],
  [8, 7, -16.8, -5.2, -0.0, 0.3],
  [8, 8, 0.9, 3.9, 0.2, 0.2],
  [9, 0, 4.6, 0.0, -0.0, 0.0],
  [9, 1, 7.8, -24.8, -0.1, -0.3],
  [9, 2, 3.0, 12.2, 0.1, 0.3],
  [9, 3, -0.2, 8.3, 0.3, -0.3],
  [9, 4, -2.5, -3.3, -0.3, 0.3],
  [9, 5, -13.1, -5.2, 0.0, 0.2],
  [9, 6, 2.4, 7.2, 0.3, -0.1],
  [9, 7, 8.6, -0.6, -0.1, -0.2],
  [9, 8, -8.7, 0.8, 0.1, 0.4],
  [9, 9, -12.9, 10.0, -0.1, 0.1],
  [10, 0, -1.3, 0.0, 0.1, 0.0],
  [10, 1, -6.4, 3.3, 0.0, 0.0],
  [10, 2, 0.2, 0.0, 0.1, -0.0],
  [10, 3, 2.0, 2.4, 0.1, -0.2],
  [10, 4, -1.0, 5.3, -0.0, 0.1],
  [10, 5, -0.6, -9.1, -0.3, -0.1],
  [10, 6, -0.9, 0.4, 0.0, 0.1],
  [10, 7, 1.5, -4.2, -0.1, 0.0],
  [10, 8, 0.9, -3.8, -0.1, -0.1],
  [10, 9, -2.7, 0.9, -0.0, 0.2],
  [10, 10, -3.9, -9.1, -0.0, -0.0],
  [11, 0, 2.9, 0.0, 0.0, 0.0],
  [11, 1, -1.5, 0.0, -0.0, -0.0],
  [11, 2, -2.5, 2.9, 0.0, 0.1],
  [11, 3, 2.4, -0.6, 0.0, -0.0],
  [11, 4, -0.6, 0.2, 0.0, 0.1],
  [11, 5, -0.1, 0.5, -0.1, -0.0],
  [11, 6, -0.6, -0.3, 0.0, -0.0],
  [11, 7, -0.1, -1.2, -0.0, 0.1],
  [11, 8, 1.1, -1.7, -0.1, -0.0],
  [11, 9, -1.0, -2.9, -0.1, 0.0],
  [11, 10, -0.2, -1.8, -0.1, 0.0],
  [11, 11, 2.6, -2.3, -0.1, 0.0],
  [12, 0, -2.0, 0.0, 0.0, 0.0],
  [12, 1, -0.2, -1.3, 0.0, -0.0],
  [12, 2, 0.3, 0.7, -0.0, 0.0],
  [12, 3, 1.2, 1.0, -0.0, -0.1],
  [12, 4, -1.3, -1.4, -0.0, 0.1],
  [12, 5, 0.6, -0.0, -0.0, -0.0],
  [12, 6, 0.6, 0.6, 0.1, -0.0],
  [12, 7, 0.5, -0.1, -0.0, -0.0],
  [12, 8, -0.1, 0.8, 0.0, 0.0],
  [12, 9, -0.4, 0.1, 0.0, -0.0],
  [12, 10, -0.2, -1.0, -0.1, -0.0],
  [12, 11, -1.3, 0.1, -0.0, 0.0],
  [12, 12, -0.7, 0.2, -0.1, -0.1],
];

function zeroMatrix(): number[][] {
  return Array.from({length: SIZE}, () => Array(SIZE).fill(0));
}

const c = zeroMatrix();
const cd = zeroMatrix();
const k = zeroMatrix();
const snorm = Array.from({length: SIZE * SIZE}, () => 0);
const fn = Array.from({length: SIZE}, () => 0);
const fm = Array.from({length: SIZE}, () => 0);

/** Load Gauss coefficients into NOAA's [m][n] / [n][m-1] layout, then un-normalize. */
function initModel(): void {
  for (const [n, m, g, h, gDot, hDot] of WMM2025) {
    c[m][n] = g;
    cd[m][n] = gDot;
    if (m !== 0) {
      c[n][m - 1] = h;
      cd[n][m - 1] = hDot;
    }
  }

  snorm[0] = 1;
  fm[0] = 0;
  for (let n = 1; n <= MAX_ORD; n++) {
    snorm[n] = (snorm[n - 1] * (2 * n - 1)) / n;
    let j = 2;
    for (let m = 0; m <= n; m++) {
      k[m][n] = ((n - 1) * (n - 1) - m * m) / ((2 * n - 1) * (2 * n - 3));
      if (m > 0) {
        const flnmj = ((n - m + 1) * j) / (n + m);
        snorm[n + m * SIZE] = snorm[n + (m - 1) * SIZE] * Math.sqrt(flnmj);
        j = 1;
        c[n][m - 1] *= snorm[n + m * SIZE];
        cd[n][m - 1] *= snorm[n + m * SIZE];
      }
      c[m][n] *= snorm[n + m * SIZE];
      cd[m][n] *= snorm[n + m * SIZE];
    }
    fn[n] = n + 1;
    fm[n] = n;
  }
  k[1][1] = 0;
}

initModel();

/** UTC decimal year, matching NOAA WMM test vectors (2025.0 = 1 Jan). */
export function decimalYear(date: Date): number {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 1);
  const next = Date.UTC(year + 1, 0, 1);
  return year + (date.getTime() - start) / (next - start);
}

/**
 * Magnetic declination in degrees (east-positive) at WGS84 geodetic
 * `latitude`/`longitude`. `altitudeKm` is height above the ellipsoid.
 */
export function magneticDeclination(
  latitude: number,
  longitude: number,
  date: Date = new Date(),
  altitudeKm = 0
): number {
  const time = decimalYear(date);
  // Secular variation: coefficients drift linearly from the 2025.0 epoch.
  const dt = time - WMM_EPOCH;

  const a2 = WGS84_A * WGS84_A;
  const b2 = WGS84_B * WGS84_B;
  const c2 = a2 - b2;
  const a4 = a2 * a2;
  const b4 = b2 * b2;
  const c4 = a4 - b4;

  const rlon = (longitude * Math.PI) / 180;
  const rlat = (latitude * Math.PI) / 180;
  const srlon = Math.sin(rlon);
  const srlat = Math.sin(rlat);
  const crlon = Math.cos(rlon);
  const crlat = Math.cos(rlat);
  const srlat2 = srlat * srlat;
  const crlat2 = crlat * crlat;

  const sp = Array.from({length: SIZE}, () => 0);
  const cp = Array.from({length: SIZE}, () => 0);
  const pp = Array.from({length: SIZE}, () => 0);
  const dp = zeroMatrix();
  const p = snorm.slice();
  const tc = zeroMatrix();

  sp[0] = 0;
  cp[0] = 1;
  pp[0] = 1;
  p[0] = 1;
  dp[0][0] = 0;
  sp[1] = srlon;
  cp[1] = crlon;

  // Geodetic lat/lon/height → spherical geocentric (ct, st, r, ca, sa).
  const q = Math.sqrt(a2 - c2 * srlat2);
  const q1 = altitudeKm * q;
  const q2 = ((q1 + a2) / (q1 + b2)) * ((q1 + a2) / (q1 + b2));
  const ct = srlat / Math.sqrt(q2 * crlat2 + srlat2);
  const st = Math.sqrt(1 - ct * ct);
  const r2 = altitudeKm * altitudeKm + 2 * q1 + (a4 - c4 * srlat2) / (q * q);
  const r = Math.sqrt(r2);
  const d = Math.sqrt(a2 * crlat2 + b2 * srlat2);
  const ca = (altitudeKm + d) / r;
  const sa = (c2 * crlat * srlat) / (r * d);

  for (let m = 2; m <= MAX_ORD; m++) {
    sp[m] = sp[1] * cp[m - 1] + cp[1] * sp[m - 1];
    cp[m] = cp[1] * cp[m - 1] - sp[1] * sp[m - 1];
  }

  const aor = EARTH_RADIUS_KM / r;
  let ar = aor * aor;
  let br = 0;
  let bt = 0;
  let bp = 0;
  let bpp = 0;

  // Spherical-harmonic sum. Recursion fills unnormalized associated
  // Legendre P and dP, then accumulates Br/Bt/Bp.
  for (let n = 1; n <= MAX_ORD; n++) {
    ar *= aor;
    for (let m = 0; m <= n; m++) {
      if (n === m) {
        p[n + m * SIZE] = st * p[n - 1 + (m - 1) * SIZE];
        dp[m][n] = st * dp[m - 1][n - 1] + ct * p[n - 1 + (m - 1) * SIZE];
      } else if (n === 1 && m === 0) {
        p[n + m * SIZE] = ct * p[n - 1 + m * SIZE];
        dp[m][n] = ct * dp[m][n - 1] - st * p[n - 1 + m * SIZE];
      } else if (n > 1 && n !== m) {
        if (m > n - 2) {
          p[n - 2 + m * SIZE] = 0;
          dp[m][n - 2] = 0;
        }
        p[n + m * SIZE] =
          ct * p[n - 1 + m * SIZE] - k[m][n] * p[n - 2 + m * SIZE];
        dp[m][n] =
          ct * dp[m][n - 1] - st * p[n - 1 + m * SIZE] - k[m][n] * dp[m][n - 2];
      }

      tc[m][n] = c[m][n] + dt * cd[m][n];
      if (m !== 0) {
        tc[n][m - 1] = c[n][m - 1] + dt * cd[n][m - 1];
      }

      const par = ar * p[n + m * SIZE];
      let temp1: number;
      let temp2: number;
      if (m === 0) {
        temp1 = tc[m][n] * cp[m];
        temp2 = tc[m][n] * sp[m];
      } else {
        temp1 = tc[m][n] * cp[m] + tc[n][m - 1] * sp[m];
        temp2 = tc[m][n] * sp[m] - tc[n][m - 1] * cp[m];
      }
      bt -= ar * temp1 * dp[m][n];
      bp += fm[m] * temp2 * par;
      br += fn[n] * temp1 * par;

      // Poles: st = 0 would divide bp; accumulate bpp from the m = 1 terms.
      if (st === 0 && m === 1) {
        if (n === 1) {
          pp[n] = pp[n - 1];
        } else {
          pp[n] = ct * pp[n - 1] - k[m][n] * pp[n - 2];
        }
        bpp += fm[m] * temp2 * ar * pp[n];
      }
    }
  }

  if (st === 0) {
    bp = bpp;
  } else {
    bp /= st;
  }

  // Spherical → geodetic: X north, Y east. Declination = atan2(Y, X).
  const bx = -bt * ca - br * sa;
  const by = bp;
  return (Math.atan2(by, bx) * 180) / Math.PI;
}
