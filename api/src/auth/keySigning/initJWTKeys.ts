import {config, keyService} from '../../buildconfig';

export async function initialiseJWTKey(): Promise<void> {
  // don't try to do this if we're testing
  if (config.runningUnderTest) return;
  try {
    // Get current public key
    const signingKey = await keyService.getSigningKey();

    // Ensure new lines are encoded properly in the config file
    const publicKey = signingKey.publicKeyString
      .replace(/\r/g, '')
      .replace(/\n/g, '\\n');

    // _local means referencing the specific node to which this URL references -
    // if in clustering situation would need to be more careful
    const couchdbConfigUrl = `${config.couchdbInternalUrl}/_node/_local/_config/jwt_keys/`;

    // rsa:kid format
    const keyName = `rsa:${signingKey.kid}`;

    // basic auth header (fetch has no equivalent of axios' auth option)
    const {username, password} = config.localCouchdbAuth;
    const authHeader =
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

    // use the couch DB config API to put the updated jwt_keys/rsa:kid value
    const response = await fetch(
      `${couchdbConfigUrl}${encodeURIComponent(keyName)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(publicKey),
      }
    );

    // unlike axios, fetch does not throw on HTTP error status codes
    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `CouchDB responded with status ${response.status}: ${body}`
      );
    }

    console.log('JWT public key configured in CouchDB');
  } catch (error) {
    console.error('JWT key configuration error:', error);
    throw new Error('Failed to configure JWT public key in CouchDB');
  }
}
