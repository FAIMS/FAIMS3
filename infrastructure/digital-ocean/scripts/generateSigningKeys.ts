import {generateKeyPairSync} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function generateSigningKeys(): {
  signingKeys: {privateKey: string; publicKey: string};
} {
  const {privateKey, publicKey} = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
    publicKeyEncoding: {type: 'spki', format: 'pem'},
  });

  return {
    signingKeys: {
      privateKey: Buffer.from(privateKey).toString('base64'),
      publicKey: Buffer.from(publicKey).toString('base64'),
    },
  };
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  process.stdout.write(`${JSON.stringify(generateSigningKeys(), null, 2)}\n`);
}
