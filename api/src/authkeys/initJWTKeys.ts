import axios from 'axios';
import {
  COUCHDB_INTERNAL_URL,
  KEY_SERVICE,
  LOCAL_COUCHDB_AUTH,
  RUNNING_UNDER_TEST,
} from '../buildconfig';

export async function initialiseJWTKey(): Promise<void> {
  // don't try to do this if we're testing
  if (RUNNING_UNDER_TEST) return;
  try {
    // Get current public key
    const signingKey = await KEY_SERVICE.getSigningKey();

    // Ensure new lines are encoded properly in the config file
    const publicKey = signingKey.publicKeyString.replace(/\n/g, '\\n');

    // _local means referencing the specific node to which this URL references -
    // if in clustering situation would need to be more careful
    const couchdbConfigUrl = `${COUCHDB_INTERNAL_URL}/_node/_local/_config/jwt_keys/`;

    // rsa:kid format
    const keyName = `rsa:${signingKey.kid}`;

    // use the couch DB config API to put the updated jwt_keys/rsa:kid value
    await axios.put(
      `${couchdbConfigUrl}${encodeURIComponent(keyName)}`,
      JSON.stringify(publicKey),
      {
        auth: LOCAL_COUCHDB_AUTH,
        headers: {'Content-Type': 'application/json'},
      }
    );
    console.log('JWT public key configured in CouchDB');
  } catch (error) {
    throw new Error('Failed to configure JWT public key in CouchDB');
  }
}
