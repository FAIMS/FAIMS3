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
import NodeCache from 'node-cache';

/** The number of seconds to cache AWS Secrets Manager responses */
const AWS_SM_CACHE_TIMEOUT_S = 300;

/**
 * Enum representing the possible sources for key retrieval.
 */
export enum KeySource {
  /** Keys are stored in local files */
  FILE = 'FILE',
  /** Keys are stored in AWS Secrets Manager */
  AWS_SM = 'AWS_SM',
}

/**
 * Interface for the key service.
 */
export interface IKeyService {
  /**
   * Retrieves the signing key.
   * @returns A Promise resolving to the SigningKey.
   */
  getSigningKey(): Promise<SigningKey>;
}

/**
 * Interface representing a signing key.
 */
export interface SigningKey {
  /** The algorithm used for signing */
  alg: string;
  /** The key ID */
  kid: string;
  /** The private key */
  privateKey: KeyLike;
  /** The public key */
  publicKey: KeyLike;
  /** The public key as a string */
  publicKeyString: string;
  /** The name of the instance */
  instanceName: string;
}

/**
 * Interface for key configuration.
 */
export interface KeyConfig {
  /** The algorithm used for signing */
  signingAlgorithm: string;
  /** The name of the instance */
  instanceName: string;
  /** The key ID */
  keyId: string;
}

/**
 * Abstract base class for key services.
 */
abstract class BaseKeyService implements IKeyService {
  protected config: KeyConfig;

  /**
   * Creates an instance of BaseKeyService.
   * @param config - The key configuration.
   */
  constructor(config: KeyConfig) {
    this.config = config;
  }

  /**
   * Abstract method to get the signing key.
   * @returns A Promise resolving to the SigningKey.
   */
  abstract getSigningKey(): Promise<SigningKey>;
}

/**
 * Interface for file-based key service configuration.
 */
interface FileKeyServiceConfig {
  /** Path to the public key file */
  publicKeyFile: string;
  /** Path to the private key file */
  privateKeyFile: string;
}

/**
 * File-based key service implementation.
 */
class FileKeyService extends BaseKeyService {
  private fileConfig: FileKeyServiceConfig;

  /**
   * Creates an instance of FileKeyService.
   * @param config - The key configuration.
   * @param fileServiceConfig - The file-specific configuration.
   */
  constructor(config: KeyConfig, fileServiceConfig: FileKeyServiceConfig) {
    super(config);
    this.fileConfig = fileServiceConfig;
  }

  /**
   * Retrieves the signing key from files.
   * @returns A Promise resolving to the SigningKey.
   * @throws Error if unable to read key files.
   */
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
 * Interface for AWS Secrets Manager key service configuration.
 */
interface AWSKeyServiceConfig {
  /** The ARN of the secret in AWS Secrets Manager */
  secretArn: string;
  /** The number of seconds to cache the secret */
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
   * Creates an instance of AWSSecretsManagerKeyService.
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

    // Try to get the signing key components from cache
    const cachedKeyComponents = this.cache.get<{
      privateKeyString: string;
      publicKeyString: string;
    }>(cacheKey);

    if (cachedKeyComponents) {
      // NOTE: we build the key each time because cache seems to have issues with getting object properties
      console.log('AWS SM Key Cache Hit');
      return this.constructSigningKey(
        cachedKeyComponents.privateKeyString,
        cachedKeyComponents.publicKeyString
      );
    }

    console.log('AWS SM Key Cache miss');

    // Get key from AWS SM
    try {
      const secretData = await this.secretsManager
        .getSecretValue({SecretId: this.awsServiceConfig.secretArn})
        .promise();

      if (!secretData.SecretString) {
        throw new Error('Secret string is undefined');
      }

      const secretJson = JSON.parse(secretData.SecretString);

      const privateKeyString = secretJson.rsa_private_key;
      const publicKeyString = secretJson.rsa_public_key;

      if (!privateKeyString || !publicKeyString) {
        throw new Error('Private or public key is missing from the secret');
      }

      // Cache the key components
      this.cache.set(cacheKey, {privateKeyString, publicKeyString});

      return this.constructSigningKey(privateKeyString, publicKeyString);
    } catch (error) {
      console.error('Failed to retrieve key from AWS Secrets Manager:', error);
      throw error;
    }
  }

  /**
   * Constructs a SigningKey object from private and public key strings.
   * @param privateKeyString - The private key as a string.
   * @param publicKeyString - The public key as a string.
   * @returns A Promise resolving to the constructed SigningKey.
   */
  private async constructSigningKey(
    privateKeyString: string,
    publicKeyString: string
  ): Promise<SigningKey> {
    const privateKey = await importPKCS8(
      privateKeyString,
      this.config.signingAlgorithm
    );
    const publicKey = await importSPKI(
      publicKeyString,
      this.config.signingAlgorithm
    );

    return {
      privateKey,
      publicKey,
      publicKeyString,
      instanceName: this.config.instanceName,
      alg: this.config.signingAlgorithm,
      kid: this.config.keyId,
    };
  }
}

/**
 * Creates and returns an instance of IKeyService based on the specified key source.
 * @param keySource - The source of the keys (FILE or AWS_SM).
 * @returns An instance of IKeyService.
 * @throws Error if an unsupported key source is specified.
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
      if (!AWS_SECRET_KEY_ARN) {
        throw new Error(
          'AWS_SECRET_KEY_ARN is not set but KEY_SOURCE is AWS_SM'
        );
      }
      return new AWSSecretsManagerKeyService(config, {
        secretArn: AWS_SECRET_KEY_ARN,
        cacheExpirySeconds: AWS_SM_CACHE_TIMEOUT_S,
      });
    default:
      throw new Error(`Unsupported key source: ${keySource}`);
  }
}

/**
 * Gets the key service based on the KEY_SOURCE environment variable.
 * @param keySource - The source of the keys (FILE or AWS_SM).
 * @returns An instance of IKeyService.
 */
export function getKeyService(
  keySource: KeySource = KeySource.FILE
): IKeyService {
  return createKeyService(keySource);
}
