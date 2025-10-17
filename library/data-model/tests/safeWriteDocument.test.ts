/*
 * Test suite for safeWriteDocument function
 * Tests the retry logic for handling PouchDB/CouchDB conflicts (409 errors)
 */

import PouchDB from 'pouchdb';
import PouchDBMemoryAdapter from 'pouchdb-adapter-memory';
import {DatabaseInterface} from '../src';

// Register memory adapter
PouchDB.plugin(PouchDBMemoryAdapter);

// Import or define the safeWriteDocument function
// (Adjust the import path as needed)
async function safeWriteDocument<T extends {}>({
  db,
  data,
  writeOnClash = true,
  maxRetries = 5,
}: {
  db: DatabaseInterface<T>;
  data: PouchDB.Core.Document<T>;
  writeOnClash?: boolean;
  maxRetries?: number;
}) {
  // Try and put directly - if no clash or _rev already provided, all good
  try {
    return await db.put(data);
  } catch (err: any) {
    // if 409 - that's conflict - get record then try again
    if (err.status === 409) {
      if (writeOnClash) {
        let attempts = 0;

        while (attempts < maxRetries) {
          try {
            const existingRecord = await db.get<T>(data._id);
            // Update _rev and otherwise put the original record
            return await db.put({...data, _rev: existingRecord._rev});
          } catch (retryErr: any) {
            attempts++;

            // If it's another 409 and we haven't hit max retries, continue loop
            if (retryErr.status === 409 && attempts < maxRetries) {
              continue;
            }

            // Either hit max retries or encountered a different error
            throw Error(
              `Failed to update record after ${attempts} attempt(s). ` +
                `Error: ${retryErr}`
            );
          }
        }

        // This shouldn't be reached, but just in case
        throw Error(`Failed to update record after ${maxRetries} retries`);
      } else {
        // writeOnClash is false, throw error
        throw Error(
          `Failed to update due to a clash, and write on clash set to false.`
        );
      }
    } else {
      // Something else happened - unsure and throw
      console.log(err);
      throw Error('Failed to update record - non 409 error: ' + err);
    }
  }
}

describe('safeWriteDocument', () => {
  let testDb: DatabaseInterface;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = new PouchDB('test-safe-write-db', {
      adapter: 'memory',
    }) as DatabaseInterface;
  });

  afterEach(async () => {
    // Clean up after each test
    await testDb.destroy();
  });

  describe('Basic functionality', () => {
    it('should successfully write a new document without conflicts', async () => {
      const doc = {
        _id: 'doc1',
        data: 'test data',
      };

      const result = await safeWriteDocument({db: testDb, data: doc});

      expect(result.ok).toBe(true);
      expect(result.id).toBe('doc1');
      expect(result.rev).toBeDefined();

      // Verify the document was actually written
      const savedDoc = await testDb.get('doc1');
      expect(savedDoc._id).toBe('doc1');
      expect((savedDoc as any).data).toBe('test data');
    });

    it('should successfully update an existing document when _rev is provided', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc2',
        data: 'initial data',
      };

      const initialResult = await testDb.put(initialDoc);

      // Update with correct _rev
      const updatedDoc = {
        _id: 'doc2',
        _rev: initialResult.rev,
        data: 'updated data',
      };

      const result = await safeWriteDocument({db: testDb, data: updatedDoc});

      expect(result.ok).toBe(true);
      expect(result.id).toBe('doc2');
      expect(result.rev).not.toBe(initialResult.rev); // Rev should have changed

      // Verify the update
      const savedDoc = await testDb.get('doc2');
      expect((savedDoc as any).data).toBe('updated data');
    });
  });

  describe('Conflict handling with writeOnClash=true', () => {
    it('should resolve a 409 conflict by fetching the latest _rev and retrying', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc3',
        data: 'initial data',
      };

      await testDb.put(initialDoc);

      // Try to update without the correct _rev (will cause 409)
      const conflictingDoc = {
        _id: 'doc3',
        data: 'conflicting data',
      };

      const result = await safeWriteDocument({
        db: testDb,
        data: conflictingDoc,
        writeOnClash: true,
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBe('doc3');

      // Verify the document was updated with the new data
      const savedDoc = await testDb.get('doc3');
      expect((savedDoc as any).data).toBe('conflicting data');
    });

    it('should handle multiple consecutive conflicts within retry limit', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc4',
        data: 'initial data',
      };

      await testDb.put(initialDoc);

      // Create a situation where we'll have multiple conflicts
      let conflictCount = 0;
      const originalGet = testDb.get.bind(testDb);
      const originalPut = testDb.put.bind(testDb);

      // Mock put to throw 409 twice, then succeed
      testDb.put = jest.fn().mockImplementation(async (doc: any) => {
        if (!doc._rev && conflictCount === 0) {
          // First attempt without _rev
          conflictCount++;
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        } else if (conflictCount < 2) {
          // Simulate another conflict during retry
          conflictCount++;
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        } else {
          // Finally succeed
          return originalPut(doc);
        }
      });

      const conflictingDoc = {
        _id: 'doc4',
        data: 'multi-conflict data',
      };

      const result = await safeWriteDocument({
        db: testDb,
        data: conflictingDoc,
        writeOnClash: true,
        maxRetries: 5,
      });

      expect(result.ok).toBe(true);
      expect(conflictCount).toBe(2); // Should have had 2 conflicts before succeeding

      // Restore original functions
      testDb.get = originalGet;
      testDb.put = originalPut;
    });

    it('should throw an error when max retries is exceeded', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc5',
        data: 'initial data',
      };

      await testDb.put(initialDoc);

      // Mock put to always throw 409
      const originalPut = testDb.put.bind(testDb);
      testDb.put = jest.fn().mockImplementation(async (doc: any) => {
        if (!doc._rev) {
          // First attempt without _rev
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        } else {
          // Always throw 409 even with _rev
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        }
      });

      const conflictingDoc = {
        _id: 'doc5',
        data: 'will fail',
      };

      await expect(
        safeWriteDocument({
          db: testDb,
          data: conflictingDoc,
          writeOnClash: true,
          maxRetries: 3,
        })
      ).rejects.toThrow(/Failed to update record after 3 attempt/);

      // Restore original function
      testDb.put = originalPut;
    });

    it('should respect custom maxRetries parameter', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc6',
        data: 'initial data',
      };

      await testDb.put(initialDoc);

      let attemptCount = 0;
      const originalPut = testDb.put.bind(testDb);

      // Mock put to always throw 409
      testDb.put = jest.fn().mockImplementation(async (doc: any) => {
        if (!doc._rev) {
          attemptCount++;
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        } else {
          attemptCount++;
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        }
      });

      const conflictingDoc = {
        _id: 'doc6',
        data: 'custom retry test',
      };

      try {
        await safeWriteDocument({
          db: testDb,
          data: conflictingDoc,
          writeOnClash: true,
          maxRetries: 2, // Custom retry limit
        });
      } catch (error: any) {
        expect(error.message).toContain('Failed to update record after 2');
        expect(attemptCount).toBe(3); // Initial attempt + 2 retries
      }

      // Restore original function
      testDb.put = originalPut;
    });
  });

  describe('Conflict handling with writeOnClash=false', () => {
    it('should throw error when conflict occurs and writeOnClash=false', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc7',
        data: 'existing data',
        metadata: 'important',
      };

      await testDb.put(initialDoc);

      // Try to write without _rev, but with writeOnClash=false
      const newDoc = {
        _id: 'doc7',
        data: 'new data',
      };

      await expect(
        safeWriteDocument({
          db: testDb,
          data: newDoc,
          writeOnClash: false,
        })
      ).rejects.toThrow(
        /Failed to update due to a clash, and write on clash set to false/
      );

      // Verify the document was NOT updated
      const savedDoc = await testDb.get('doc7');
      expect((savedDoc as any).data).toBe('existing data');
      expect((savedDoc as any).metadata).toBe('important');
    });

    it('should write new document even when writeOnClash=false if no conflict', async () => {
      const newDoc = {
        _id: 'doc8',
        data: 'brand new data',
      };

      const result = await safeWriteDocument({
        db: testDb,
        data: newDoc,
        writeOnClash: false,
      });

      expect(result.ok).toBe(true);
      expect(result.id).toBe('doc8');

      // Verify the document was written
      const savedDoc = await testDb.get('doc8');
      expect((savedDoc as any).data).toBe('brand new data');
    });

    it('should throw error when trying to update with _rev and writeOnClash=false causes conflict', async () => {
      // Create initial document
      const initialDoc = {
        _id: 'doc7b',
        data: 'v1',
      };

      const v1Result = await testDb.put(initialDoc);

      // Update it to create v2
      await testDb.put({
        _id: 'doc7b',
        _rev: v1Result.rev,
        data: 'v2',
      });

      // Try to update with old _rev (v1) and writeOnClash=false
      const staleDoc = {
        _id: 'doc7b',
        _rev: v1Result.rev, // This is now stale
        data: 'conflicting update',
      };

      await expect(
        safeWriteDocument({
          db: testDb,
          data: staleDoc,
          writeOnClash: false,
        })
      ).rejects.toThrow(
        /Failed to update due to a clash, and write on clash set to false/
      );

      // Verify the document still has v2 data
      const savedDoc = await testDb.get('doc7b');
      expect((savedDoc as any).data).toBe('v2');
    });
  });

  describe('Error handling', () => {
    it('should throw error for non-409 database errors', async () => {
      // Mock put to throw a different error
      const originalPut = testDb.put.bind(testDb);
      testDb.put = jest.fn().mockImplementation(async () => {
        const error = new Error('Network error') as any;
        error.status = 500;
        throw error;
      });

      const doc = {
        _id: 'doc9',
        data: 'test',
      };

      await expect(safeWriteDocument({db: testDb, data: doc})).rejects.toThrow(
        /Failed to update record - non 409 error/
      );

      // Restore original function
      testDb.put = originalPut;
    });

    it('should throw error if get fails during conflict resolution', async () => {
      // Create initial document
      await testDb.put({_id: 'doc10', data: 'initial'});

      const originalPut = testDb.put.bind(testDb);
      const originalGet = testDb.get.bind(testDb);

      // Mock put to throw 409
      testDb.put = jest.fn().mockImplementation(async (doc: any) => {
        if (!doc._rev) {
          const error = new Error('Document update conflict') as any;
          error.status = 409;
          throw error;
        }
        return originalPut(doc);
      });

      // Mock get to fail
      testDb.get = jest.fn().mockImplementation(async () => {
        const error = new Error('Database error') as any;
        error.status = 500;
        throw error;
      });

      const doc = {
        _id: 'doc10',
        data: 'updated',
      };

      await expect(
        safeWriteDocument({db: testDb, data: doc, writeOnClash: true})
      ).rejects.toThrow(/Failed to update record after 1 attempt/);

      // Restore original functions
      testDb.put = originalPut;
      testDb.get = originalGet;
    });

    it('should handle documents with complex nested data structures', async () => {
      const complexDoc = {
        _id: 'doc11',
        data: {
          nested: {
            deeply: {
              value: 'test',
              array: [1, 2, 3],
            },
          },
          metadata: {
            created: new Date().toISOString(),
            tags: ['tag1', 'tag2'],
          },
        },
      };

      const result = await safeWriteDocument({db: testDb, data: complexDoc});

      expect(result.ok).toBe(true);

      const savedDoc = await testDb.get('doc11');
      expect((savedDoc as any).data.nested.deeply.value).toBe('test');
      expect((savedDoc as any).data.metadata.tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty data object', async () => {
      const doc = {
        _id: 'doc12',
      };

      const result = await safeWriteDocument({db: testDb, data: doc});

      expect(result.ok).toBe(true);
      expect(result.id).toBe('doc12');

      const savedDoc = await testDb.get('doc12');
      expect(savedDoc._id).toBe('doc12');
    });

    it('should handle maxRetries of 0', async () => {
      // Create initial document
      await testDb.put({_id: 'doc14', data: 'initial'});

      const doc = {
        _id: 'doc14',
        data: 'updated',
      };

      // With maxRetries=0, should fail immediately on conflict
      await expect(
        safeWriteDocument({
          db: testDb,
          data: doc,
          writeOnClash: true,
          maxRetries: 0,
        })
      ).rejects.toThrow(/Failed to update record after 0 retries/);
    });

    it('should handle maxRetries of 1', async () => {
      // Create initial document
      await testDb.put({_id: 'doc15', data: 'initial'});

      const doc = {
        _id: 'doc15',
        data: 'updated',
      };

      // With maxRetries=1, should succeed on first retry
      const result = await safeWriteDocument({
        db: testDb,
        data: doc,
        writeOnClash: true,
        maxRetries: 1,
      });

      expect(result.ok).toBe(true);

      const savedDoc = await testDb.get('doc15');
      expect((savedDoc as any).data).toBe('updated');
    });
  });

  describe('Concurrent write scenarios', () => {
    it('should handle multiple concurrent writes to the same document', async () => {
      // Create initial document
      await testDb.put({_id: 'doc17', data: 'initial', counter: 0});

      // Simulate multiple concurrent writes
      const writes = Array.from({length: 5}, (_, i) =>
        safeWriteDocument({
          db: testDb,
          data: {
            _id: 'doc17',
            data: `write-${i}`,
            counter: i,
          },
          writeOnClash: true,
          maxRetries: 10,
        })
      );

      // All writes should eventually succeed
      const results = await Promise.all(writes);

      results.forEach(result => {
        expect(result.ok).toBe(true);
        expect(result.id).toBe('doc17');
      });

      // Verify the document exists and has one of the values
      const savedDoc = await testDb.get('doc17');
      expect(savedDoc._id).toBe('doc17');
      expect((savedDoc as any).counter).toBeGreaterThanOrEqual(0);
      expect((savedDoc as any).counter).toBeLessThan(5);
    });

    it('should handle write after delete', async () => {
      // Create and delete a document
      const initialResult = await testDb.put({_id: 'doc18', data: 'initial'});
      await testDb.remove('doc18', initialResult.rev);

      // Try to write a new document with the same ID
      const doc = {
        _id: 'doc18',
        data: 'recreated',
      };

      const result = await safeWriteDocument({db: testDb, data: doc});

      expect(result.ok).toBe(true);

      const savedDoc = await testDb.get('doc18');
      expect((savedDoc as any).data).toBe('recreated');
    });
  });
});
