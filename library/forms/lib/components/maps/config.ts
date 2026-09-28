// SPDX-License-Identifier: Apache-2.0

/*
 * Description:
 *   This module exports the configuration of the build
 */

import {MapConfig} from './types';

export const getDefaultMapConfig = (): MapConfig => ({
  mapSource: 'osm',
  mapSourceKey: '',
  mapStyle: 'basic',
});
