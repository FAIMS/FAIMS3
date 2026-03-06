/*
 * Copyright 2023 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Description:
 *   Custom hooks for location services
 */

import {Geolocation, Position} from '@capacitor/geolocation';
import {useQuery, useQueryClient, UseQueryResult} from '@tanstack/react-query';
import {logInfo, logWarn} from '../logging';

export interface LocationOptions {
  /**
   * Enable high accuracy mode for better results
   * @default true
   */
  enableHighAccuracy?: boolean;

  /**
   * Consider the query stale after this many milliseconds
   * @default 0 (always stale)
   */
  staleTime?: number;

  /**
   * Keep the data in cache for this many milliseconds
   * @default 300000 (5 minutes)
   */
  gcTime?: number;

  /**
   * Refetch interval in milliseconds (undefined means no automatic refetching)
   * @default undefined
   */
  refetchInterval?: number | false;
}

/**
 * Hook to get the current device location with optimized caching
 *
 * @param options Configuration options for the location request
 * @returns Query result with full Position object from Geolocation API
 */
export function useCurrentLocation(
  options: LocationOptions = {}
): UseQueryResult<Position, Error> {
  const queryClient = useQueryClient();

  const {
    enableHighAccuracy = true,
    staleTime = 0,
    gcTime = 1000 * 60 * 5, // 5 minutes
    refetchInterval = undefined,
  } = options;

  return useQuery({
    queryKey: ['current_location'],
    networkMode: 'always', // it's GPS, not network
    staleTime: staleTime,
    gcTime: gcTime,
    refetchInterval: refetchInterval,
    queryFn: async (): Promise<Position> => {
      try {
        // First try to get a quick response using cached position
        const cachedPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 1000, // Short timeout
          maximumAge: 60000, // Use positions up to 1 minute old
        });

        // Start fetching the accurate position in the background
        const accuratePositionPromise = Geolocation.getCurrentPosition({
          enableHighAccuracy: enableHighAccuracy,
          timeout: 15000, // Longer timeout for accuracy
          maximumAge: 0, // Force fresh position
        });

        // When the accurate position arrives, update the query data
        accuratePositionPromise
          .then(accuratePosition => {
            // Only update if it's significantly different
            if (
              Math.abs(
                accuratePosition.coords.longitude -
                  cachedPosition.coords.longitude
              ) > 0.0001 ||
              Math.abs(
                accuratePosition.coords.latitude -
                  cachedPosition.coords.latitude
              ) > 0.0001
            ) {
              queryClient.setQueryData(['current_location'], accuratePosition);
            }
          })
          .catch(error => {
            logWarn('Failed to get accurate position:', error);
          });

        // Return the cached position immediately
        return cachedPosition;
      } catch (error) {
        // If cached position fails, fall back to accurate position
        logInfo('No cached position available, getting accurate position...');
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: enableHighAccuracy,
          timeout: 15000,
          maximumAge: 0,
        });
        return position;
      }
    },
  });
}

/**
 * Helper function to extract coordinates from a Position object
 *
 * @param position The Position object from Geolocation API
 * @returns Coordinates as [longitude, latitude]
 */
export function getCoordinates(
  position: Position | undefined
): [number, number] | undefined {
  if (!position) return undefined;
  return [position.coords.longitude, position.coords.latitude];
}
