import axios from 'axios';
import {config, keyService} from '../../buildconfig';

export async function initialiseJWTKey(): Promise<void> {
  // don't try to do this if we're testing
  if (config.runningUnderTest) return;
  try {
    // Get current public key
    const signingKey = await keyService.getSigningKey();

    // Ensure new lines are encoded properly in the config file
    const publicKey = signingKey.publicKeyString.replace(/\n/g, '\\n');

    // _local means referencing the specific node to which this URL references -
    // if in clustering situation would need to be more careful
    const couchdbConfigUrl = `${config.couchdbInternalUrl}/_node/_local/_config/jwt_keys/`;

    // rsa:kid format
    const keyName = `rsa:${signingKey.kid}`;

    // use the couch DB config API to put the updated jwt_keys/rsa:kid value
    await axios.put(
      `${couchdbConfigUrl}${encodeURIComponent(keyName)}`,
      JSON.stringify(publicKey),
      {
        auth: config.localCouchdbAuth,
        headers: {'Content-Type': 'application/json'},
      }
    );
    console.log('JWT public key configured in CouchDB');
  } catch (error) {
    throw new Error('Failed to configure JWT public key in CouchDB');
  }
}
