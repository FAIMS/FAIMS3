/*
 * Copyright 2021, 2022 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import z from 'zod';

/**
 * Address schema based on GeocodeJSON, an extension to GeoJSON for storing
 * address data. https://github.com/geocoders/geocodejson-spec/blob/master/draft/README.md
 * This format is returned by some reverse geocoding APIs and is used by
 * AddressField and address autosuggest services.
 */
export const AddressSchema = z.object({
  house_number: z.string().optional(),
  road: z.string().optional(),
  suburb: z.string().optional(),
  town: z.string().optional(),
  municipality: z.string().optional(),
  state: z.string().optional(),
  postcode: z.string().optional(),
  country: z.string().optional(),
  country_code: z.string().optional(),
});

export type AddressType = z.infer<typeof AddressSchema>;

/**
 * Schema for the full address value.
 * - display_name: always the string to show (from search or manual).
 * - address: structured parts when set via search/autosuggest (mutually exclusive with manuallyEnteredAddress).
 * - manuallyEnteredAddress: raw string when offline or user chose free-text (mutually exclusive with address).
 */
export const AddressValueSchema = z
  .object({
    display_name: z.string(),
    address: AddressSchema.optional(),
    manuallyEnteredAddress: z.string().optional(),
  })
  .refine(
    val => {
      const hasAddress =
        val.address && Object.values(val.address).some(Boolean);
      const hasManual = val.manuallyEnteredAddress?.trim();
      if (hasAddress && hasManual) return false;
      return true;
    },
    {message: 'Cannot have both address and manuallyEnteredAddress'}
  );

export type AddressValue = z.infer<typeof AddressValueSchema>;
