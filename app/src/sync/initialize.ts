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
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: index.ts
 * Description:
 *   TODO
 */
import PouchDB from 'pouchdb-browser';
import {DEBUG_POUCHDB} from '../buildconfig';
import {clone} from 'lodash';
import {getAllListings} from '.';
import {parseToken} from '../users';
import ObjectMap from '../utils/ObjectMap';
import {local_auth_db, LocalAuthDoc} from './databases';
import {events} from './events';
import {update_directory} from './process-initialization';
import {register_basic_automerge_resolver, register_sync_state} from './state';

/**
 *
 * @returns creates all project PouchDB objects and metadata
 * DBs synced
 */
export async function initialize() {
  if (DEBUG_POUCHDB) PouchDB.debug.enable('*');

  register_sync_state(events);
  register_basic_automerge_resolver(events);
  await update_directory().catch(err => events.emit('directory_error', err));

  // Initialise auth DB
  await initialiseAuthDB();
}

/**
 * Initializes and validates the local authentication database.
 *
 * This function performs several maintenance tasks on the local auth database:
 * 1. Validates that all stored auth documents correspond to known listings
 * 2. Ensures all stored tokens are well-formed and parseable
 * 3. Maintains consistency between available tokens and current username
 * 4. Removes invalid or orphaned auth entries
 *
 * The function is designed to be fault-tolerant and will:
 * - Skip processing of individual documents if errors occur
 * - Log errors for debugging but continue execution
 * - Maintain database integrity even with partial failures
 *
 * @returns Promise<void> - Resolves when initialization is complete
 * @throws Error - Only if the initial database global variable initialisation
 * fails
 */
async function initialiseAuthDB(): Promise<void> {
  // TODO this should be provided through context or similar mechanism
  let db: PouchDB.Database<LocalAuthDoc>;

  // Initialize database connection with error handling
  try {
    db = local_auth_db;
    if (!db) {
      throw new Error(
        'The local auth DB is null or undefined during initialisation.'
      );
    }
  } catch (error) {
    console.error('Fatal: Could not initialize local auth DB:', error);
    throw error; // Re-throw as this is a fatal initialization error
  }

  try {
    // Fetch all documents and listings
    const allDocs = (await db.allDocs({include_docs: true})).rows
      .map(d => d.doc)
      .filter(d => !!d);

    const listingsMap = new Map((await getAllListings()).map(l => [l.id, l]));

    // Process each document
    for (const doc of allDocs) {
      try {
        // What is the listing ID?
        const listingId = doc._id;

        // Check that we know about the listing
        if (!listingsMap.has(listingId)) {
          console.log(`Removing auth doc for unknown listing: ${listingId}`);
          await db.remove(doc, {});
          continue;
        }

        // Make a new document
        const updatedDoc = clone(doc);
        let needsUpdate = false;

        // Process available tokens
        const usernamesToDelete: string[] = [];
        for (const username of Object.keys(updatedDoc.available_tokens)) {
          try {
            // Validate username
            if (!username || username.length === 0) {
              usernamesToDelete.push(username);
              console.error(
                `Invalid username found in auth doc ${listingId}, removing entry`
              );
              continue;
            }

            // Process token
            const token = ObjectMap.get(updatedDoc.available_tokens, username)!;
            try {
              const parsedToken = await parseToken(token.token);

              // Update parsed token if missing
              if (!token.parsedToken) {
                console.log(
                  `Auth doc had entry for listing ${listingId} and user ${username} which was missing parsedToken. Injecting...`
                );
                token.parsedToken = parsedToken;
                needsUpdate = true;
              }
            } catch (tokenError) {
              console.error(
                `Error parsing token for username ${username} in listing ${listingId}:`,
                tokenError
              );
              usernamesToDelete.push(username);
            }
          } catch (tokenProcessError) {
            console.error(
              `Error processing token for username ${username}:`,
              tokenProcessError
            );
            usernamesToDelete.push(username);
          }
        }

        // Remove invalid username entries
        usernamesToDelete.forEach(username => {
          console.log(
            `Deleting ${username} from listing: ${listingId} authDoc.`
          );
          delete updatedDoc.available_tokens[username];
          needsUpdate = true;
        });

        // Check if document is still valid after token processing
        if (Object.keys(updatedDoc.available_tokens).length === 0) {
          console.log(
            `Removing auth doc ${listingId} as it has no valid tokens remaining`
          );
          await db.remove(doc, {});
          continue;
        }

        // Validate current username
        try {
          const isMissing =
            !updatedDoc.current_username ||
            updatedDoc.current_username.length === 0;
          const isValid = Object.values(updatedDoc.available_tokens).some(
            t => t.parsedToken.username === updatedDoc.current_username
          );

          if (isMissing || !isValid) {
            const firstToken = Object.values(updatedDoc.available_tokens)[0];
            if (!firstToken) {
              throw new Error('No valid tokens found for username update');
            }
            updatedDoc.current_username = firstToken.parsedToken.username;
            needsUpdate = true;
            console.log(
              `Updated current username for listing ${listingId} to ${updatedDoc.current_username}`
            );
          }
        } catch (usernameError) {
          console.error(
            `Error processing current username for listing ${listingId}:`,
            usernameError
          );
          continue;
        }

        // Update document if needed
        if (needsUpdate) {
          try {
            await db.put(updatedDoc);
            console.log(
              `Successfully updated auth doc for listing ${listingId}`
            );
          } catch (updateError) {
            console.error(
              `Failed to update auth doc for listing ${listingId}:`,
              updateError
            );
          }
        }
      } catch (docError) {
        console.error('Error processing auth doc:', docError);
        continue;
      }
    }

    console.log(
      'Successfully completed initialization and validation of local auth DB'
    );
  } catch (error) {
    console.error('Error during auth DB initialization:', error);
    // Don't throw here - we want the function to complete even with errors
  }
}
