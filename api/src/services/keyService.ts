import fs from 'fs/promises';
import {importPKCS8, importSPKI, KeyLike} from 'jose';
import {
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_KEY_ID,
  CONDUCTOR_PUBLIC_KEY_PATH,
  CONDUCTOR_PRIVATE_KEY_PATH,
} from '../buildconfig';

// Define an enum for allowable key source values
export enum KeySource {
  FILE = 'FILE',
  AWS_SM = 'AWS_SM',
}

/**
 * Interface for the key service
 */
export interface IKeyService {
  getSigningKey(): Promise<SigningKey>;
}

/**
 * SigningKey interface
 */
export interface SigningKey {
  alg: string;
  kid: string;
  privateKey: KeyLike;
  publicKey: KeyLike;
  publicKeyString: string;
  instanceName: string;
}

/**
 * KeyConfig interface
 */
export interface KeyConfig {
  signingAlgorithm: string;
  instanceName: string;
  keyId: string;
}

/**
 * Base class for key services
 */
abstract class BaseKeyService implements IKeyService {
  protected config: KeyConfig;

  constructor(config: KeyConfig) {
    this.config = config;
  }

  abstract getSigningKey(): Promise<SigningKey>;
}

interface FileKeyServiceConfig {
  publicKeyFile: string;
  privateKeyFile: string;
}

/**
 * File-based key service implementation
 */
class FileKeyService extends BaseKeyService {
  fileConfig: FileKeyServiceConfig;

  constructor(config: KeyConfig, fileServiceConfig: FileKeyServiceConfig) {
    super(config);
    this.fileConfig = fileServiceConfig;
  }

  async getSigningKey(): Promise<SigningKey> {
    let privateKeyString: string;
    let publicKeyString: string;

    try {
      privateKeyString = await fs.readFile(
        this.fileConfig.privateKeyFile,
        'utf-8'
      );
      publicKeyString = await fs.readFile(
        this.fileConfig.publicKeyFile,
        'utf-8'
      );
    } catch (err) {
      throw new Error(`Failed to read key files: ${err}`);
    }

    const private_key = await importPKCS8(
      privateKeyString,
      this.config.signingAlgorithm
    );
    const public_key = await importSPKI(
      publicKeyString,
      this.config.signingAlgorithm
    );

    return {
      privateKey: private_key,
      publicKey: public_key,
      publicKeyString: publicKeyString,
      instanceName: this.config.instanceName,
      alg: this.config.signingAlgorithm,
      kid: this.config.keyId,
    };
  }
}

/**
 * Placeholder for AWS Secrets Manager key service implementation
 */
class AWSSecretsManagerKeyService extends BaseKeyService {
  async getSigningKey(): Promise<SigningKey> {
    // TODO: Implement AWS Secrets Manager key retrieval
    throw new Error('AWS Secrets Manager key service not implemented');
  }
}

/**
 * Key service factory
 */
export function createKeyService(
  keySource: KeySource = KeySource.FILE
): IKeyService {
  const config: KeyConfig = {
    signingAlgorithm: 'RS256',
    instanceName: CONDUCTOR_INSTANCE_NAME,
    keyId: CONDUCTOR_KEY_ID,
  };

  switch (keySource) {
    case KeySource.FILE:
      return new FileKeyService(config, {
        publicKeyFile: CONDUCTOR_PUBLIC_KEY_PATH,
        privateKeyFile: CONDUCTOR_PRIVATE_KEY_PATH,
      });
    case KeySource.AWS_SM:
      return new AWSSecretsManagerKeyService(config);
    default:
      throw new Error(`Unsupported key source: ${keySource}`);
  }
}

/**
 * Get the key service based on the KEY_SOURCE environment variable
 */
export function getKeyService(
  keySource: KeySource = KeySource.FILE
): IKeyService {
  return createKeyService(keySource);
}
