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
 * Filename: autoincrement.test.ts
 * Description:
 *   Tests for the AutoIncrementer class using real in-memory PouchDB
 */

import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
// eslint-disable-next-line n/no-extraneous-import
import PouchDB from 'pouchdb';
import memoryAdapter from 'pouchdb-adapter-memory';
import {AutoIncrementer} from './autoincrement';
import {
  LocalAutoIncrementState,
  LocalAutoIncrementRange,
} from './autoincrementTypes';
import {databaseService} from '../context/slices/helpers/databaseService';

// Register memory adapter
PouchDB.plugin(memoryAdapter);

// Mock store and logging
vi.mock('../logging', () => ({
  logError: vi.fn(),
}));

vi.mock('../context/store', () => ({
  store: {
    getState: vi.fn().mockReturnValue({
      projects: {
        byId: {},
      },
    }),
  },
  selectProjectById: vi.fn().mockReturnValue(null),
}));

describe('AutoIncrementer', () => {
  // Test data
  const PROJECT_ID = 'test-project';
  const FORM_ID = 'test-form';
  const FIELD_ID = 'test-field';
  const POUCH_ID =
    'local-autoincrement-state-test-project-test-form-test-field';

  // In-memory database
  let memoryDB: PouchDB.Database<LocalAutoIncrementState>;
  let originalGetLocalStateDatabase: any;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create in-memory database for testing
    memoryDB = new PouchDB('test-local-state-db', {adapter: 'memory'});

    // Save original method and replace with our test version
    originalGetLocalStateDatabase = databaseService.getLocalStateDatabase;

    // Override the database service to use our in-memory database
    databaseService.getLocalStateDatabase = vi.fn().mockReturnValue(memoryDB);
  });

  afterEach(async () => {
    // Restore original method
    databaseService.getLocalStateDatabase = originalGetLocalStateDatabase;

    // Destroy test database
    await memoryDB.destroy();
  });

  describe('constructor', () => {
    it('should properly initialize the AutoIncrementer', () => {
      new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      expect(databaseService.getLocalStateDatabase).toHaveBeenCalled();
    });
  });

  describe('getState', () => {
    it('should return the state from the database if it exists', async () => {
      // Prepare a document in the database
      const mockState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(mockState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.getState();

      // PouchDB will add _rev to the document when it's stored
      expect(result._id).toEqual(POUCH_ID);
      expect(result.last_used_id).toEqual(5);
      expect(result.ranges).toEqual([
        {start: 1, stop: 10, fully_used: false, using: true},
      ]);
    });

    it('should create and store a new state if not found in database', async () => {
      // No need to prepare anything - document doesn't exist yet

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.getState();

      // Verify the document was created correctly
      expect(result._id).toEqual(POUCH_ID);
      expect(result.last_used_id).toBeNull();
      expect(result.ranges).toEqual([]);

      // Verify document exists in database
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc._id).toEqual(POUCH_ID);
      expect(dbDoc.last_used_id).toBeNull();
      expect(dbDoc.ranges).toEqual([]);
    });
  });

  describe('setState', () => {
    it('should update the state in the database', async () => {
      // First create a document
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(initialState);

      // Get the document with the _rev
      const docWithRev = await memoryDB.get(POUCH_ID);

      // Now update it
      const updatedState = {
        ...docWithRev,
        last_used_id: 10,
        ranges: [{start: 1, stop: 20, fully_used: false, using: true}],
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      await incrementer.setState(updatedState);

      // Verify document was updated
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.last_used_id).toEqual(10);
      expect(dbDoc.ranges).toEqual([
        {start: 1, stop: 20, fully_used: false, using: true},
      ]);
    });
  });

  describe('addRange', () => {
    it('should add a new range to the state', async () => {
      // Create incrementer and get initial state (will be created)
      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      await incrementer.getState();

      // Add a range
      const result = await incrementer.addRange({start: 100, stop: 200});

      // Expected new range
      const expectedRange: LocalAutoIncrementRange = {
        start: 100,
        stop: 200,
        fully_used: false,
        using: false,
      };

      // Verify result
      expect(result).toEqual(expectedRange);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.ranges).toEqual([expectedRange]);
    });
  });

  describe('removeRange', () => {
    it('should remove a range at the specified index', async () => {
      // Setup initial state with multiple ranges
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [
          {start: 1, stop: 10, fully_used: false, using: false},
          {start: 11, stop: 20, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      // Remove first range
      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      await incrementer.removeRange(0);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.ranges).toEqual([
        {start: 11, stop: 20, fully_used: false, using: false},
      ]);
    });

    it('should throw error if index is out of range', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [{start: 1, stop: 10, fully_used: false, using: false}],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);

      await expect(incrementer.removeRange(1)).rejects.toThrow(
        'Index out of range'
      );
      await expect(incrementer.removeRange(-1)).rejects.toThrow(
        'Index out of range'
      );
    });

    it('should throw error if trying to remove a range that is currently in use', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);

      await expect(incrementer.removeRange(0)).rejects.toThrow(
        'Cannot remove a range that is currently in use'
      );
    });
  });

  describe('updateRange', () => {
    it('should update a range at the specified index', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [{start: 1, stop: 10, fully_used: false, using: false}],
      };

      await memoryDB.put(initialState);

      const newRange: LocalAutoIncrementRange = {
        start: 1,
        stop: 20,
        fully_used: false,
        using: false,
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      await incrementer.updateRange(0, newRange);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.ranges[0]).toEqual(newRange);
    });

    it('should throw error if index is out of range', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [{start: 1, stop: 10, fully_used: false, using: false}],
      };

      await memoryDB.put(initialState);

      const newRange: LocalAutoIncrementRange = {
        start: 1,
        stop: 20,
        fully_used: false,
        using: false,
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);

      await expect(incrementer.updateRange(1, newRange)).rejects.toThrow(
        'Index out of range'
      );
    });

    it('should mark a range as not using if fully_used is set to true', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(initialState);

      const newRange: LocalAutoIncrementRange = {
        start: 1,
        stop: 10,
        fully_used: true,
        using: true, // This should be set to false after the update
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      await incrementer.updateRange(0, newRange);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.ranges[0].fully_used).toEqual(true);
      expect(dbDoc.ranges[0].using).toEqual(false); // Should be set to false
    });

    it('should throw error if trying to change start of a range in use', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(initialState);

      const newRange: LocalAutoIncrementRange = {
        start: 2, // Changed from 1
        stop: 10,
        fully_used: false,
        using: true,
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);

      await expect(incrementer.updateRange(0, newRange)).rejects.toThrow(
        "Can't change start of currently used range"
      );
    });

    it('should throw error if trying to set stop value less than last_used_id', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 5,
        ranges: [{start: 1, stop: 10, fully_used: false, using: true}],
      };

      await memoryDB.put(initialState);

      const newRange: LocalAutoIncrementRange = {
        start: 1,
        stop: 5, // Less than last_used_id
        fully_used: false,
        using: true,
      };

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);

      await expect(incrementer.updateRange(0, newRange)).rejects.toThrow(
        'Currently used range stop less than last used ID.'
      );
    });
  });

  describe('getRanges', () => {
    it('should return all ranges from the state', async () => {
      const ranges = [
        {start: 1, stop: 10, fully_used: false, using: false},
        {start: 11, stop: 20, fully_used: false, using: true},
      ];

      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 15,
        ranges: ranges,
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.getRanges();

      expect(result).toEqual(ranges);
    });
  });

  describe('nextValue', () => {
    it('should return undefined if no ranges are allocated', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.nextValue();

      expect(result).toBeUndefined();
    });

    it('should return the first value from first range if no values have been used', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: null,
        ranges: [
          {start: 100, stop: 200, fully_used: false, using: false},
          {start: 300, stop: 400, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.nextValue();

      expect(result).toBe(100);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.last_used_id).toBe(100);
      expect(dbDoc.ranges[0].using).toBe(true);
    });

    it('should return the next value in the currently used range', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 105,
        ranges: [
          {start: 100, stop: 200, fully_used: false, using: true},
          {start: 300, stop: 400, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.nextValue();

      expect(result).toBe(106);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.last_used_id).toBe(106);
    });

    it('should move to the next range when current range is exhausted', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 200,
        ranges: [
          {start: 100, stop: 200, fully_used: false, using: true},
          {start: 300, stop: 400, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.nextValue();

      expect(result).toBe(300);

      // Verify database state
      const dbDoc = await memoryDB.get(POUCH_ID);
      expect(dbDoc.last_used_id).toBe(300);
      expect(dbDoc.ranges[0].fully_used).toBe(true);
      expect(dbDoc.ranges[0].using).toBe(false);
      expect(dbDoc.ranges[1].using).toBe(true);
    });

    it('should return undefined if all ranges are fully used', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 399,
        ranges: [
          {start: 100, stop: 200, fully_used: true, using: false},
          {start: 300, stop: 400, fully_used: true, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.nextValue();

      expect(result).toBeUndefined();
    });
  });

  describe('getDisplayStatus', () => {
    it('should return status with end value when a range is in use', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 105,
        ranges: [
          {start: 100, stop: 200, fully_used: false, using: true},
          {start: 300, stop: 400, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.getDisplayStatus('Test Label');

      expect(result).toEqual({
        label: 'Test Label',
        last_used: 105,
        end: 200,
      });
    });

    it('should return status with null end value when no range is in use', async () => {
      // Setup initial state
      const initialState: LocalAutoIncrementState = {
        _id: POUCH_ID,
        last_used_id: 199,
        ranges: [
          {start: 100, stop: 200, fully_used: true, using: false},
          {start: 300, stop: 400, fully_used: false, using: false},
        ],
      };

      await memoryDB.put(initialState);

      const incrementer = new AutoIncrementer(PROJECT_ID, FORM_ID, FIELD_ID);
      const result = await incrementer.getDisplayStatus('Test Label');

      expect(result).toEqual({
        label: 'Test Label',
        last_used: 199,
        end: null,
      });
    });
  });
});
