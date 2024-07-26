import fs from 'fs/promises';
import {importPKCS8, importSPKI, KeyLike} from 'jose';
import {
  CONDUCTOR_INSTANCE_NAME,
  CONDUCTOR_KEY_ID,
  CONDUCTOR_PUBLIC_KEY_PATH,
  CONDUCTOR_PRIVATE_KEY_PATH,
  AWS_SECRET_KEY_ARN,
} from '../buildconfig';
import {SecretsManager} from 'aws-sdk';
import {SecretsManagerCache} from 'aws-secrets-manager-cache';
import NodeCache from 'node-cache';

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

interface AWSKeyServiceConfig {
  secretArn: string;
  cacheExpirySeconds: number;
}

/**
 * AWS Secrets Manager Key service implementation with custom caching.
 * Uses AWS Secret Manager to store the keys and caches them for improved performance.
 */
class AWSSecretsManagerKeyService extends BaseKeyService {
  private awsServiceConfig: AWSKeyServiceConfig;
  private secretsManager: SecretsManager;
  private cache: NodeCache;

  /**
   * Constructs an instance of AWSSecretsManagerKeyService.
   * @param config - The key configuration.
   * @param awsServiceConfig - AWS-specific configuration including secret ARN and cache expiry.
   */
  constructor(config: KeyConfig, awsServiceConfig: AWSKeyServiceConfig) {
    super(config);
    this.awsServiceConfig = awsServiceConfig;
    this.secretsManager = new SecretsManager();
    this.cache = new NodeCache({
      stdTTL: this.awsServiceConfig.cacheExpirySeconds,
    });
  }

  /**
   * Retrieves the signing key from AWS Secrets Manager, using caching for improved performance.
   * @returns A Promise resolving to the SigningKey.
   * @throws Error if unable to retrieve or parse the secret.
   */
  async getSigningKey(): Promise<SigningKey> {
    const cacheKey = `signing-key-${this.awsServiceConfig.secretArn}`;

    // Try to get the signing key from cache
    const cachedSigningKey = this.cache.get<SigningKey>(cacheKey);
    if (cachedSigningKey) {
      // cache hit
      console.log('AWS SM Key Cache Hit');
      return cachedSigningKey;
    }

    // cache miss
    console.log('AWS SM Key Cache miss');

    try {
      // If not in cache, retrieve from AWS Secrets Manager
      const secretData = await this.secretsManager
        .getSecretValue({SecretId: this.awsServiceConfig.secretArn})
        .promise();

      if (!secretData.SecretString) {
        throw new Error('Secret string is undefined');
      }

      const secretJson = JSON.parse(secretData.SecretString);

      // Extract keys from the secret structure
      const privateKeyString = secretJson.rsa_private_key;
      const publicKeyString = secretJson.rsa_public_key;

      if (!privateKeyString || !publicKeyString) {
        throw new Error('Private or public key is missing from the secret');
      }

      // Import the keys
      const privateKey = await importPKCS8(
        privateKeyString,
        this.config.signingAlgorithm
      );
      const publicKey = await importSPKI(
        publicKeyString,
        this.config.signingAlgorithm
      );

      // Construct the SigningKey
      const signingKey: SigningKey = {
        privateKey,
        publicKey,
        publicKeyString,
        instanceName: this.config.instanceName,
        alg: this.config.signingAlgorithm,
        kid: this.config.keyId,
      };

      // Cache the signing key
      this.cache.set(cacheKey, signingKey);

      return signingKey;
    } catch (error) {
      console.error('Failed to retrieve key from AWS Secrets Manager:', error);
      throw error;
    }
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
    // From file
    case KeySource.FILE:
      return new FileKeyService(config, {
        publicKeyFile: CONDUCTOR_PUBLIC_KEY_PATH,
        privateKeyFile: CONDUCTOR_PRIVATE_KEY_PATH,
      });
    // From AWS Secret manager
    case KeySource.AWS_SM:
      if (!AWS_SECRET_KEY_ARN) {
        throw new Error(
          'AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM'
        );
      }
      return new AWSSecretsManagerKeyService(config, {
        secretArn: AWS_SECRET_KEY_ARN,
        // 5 minutes
        cacheExpirySeconds: 300,
      });
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
