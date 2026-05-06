import {AttachmentServiceType, IAttachmentService} from './types';
import {CouchAttachmentService, CouchAttachmentServiceConfig} from './couch';

/**
 * Parameters for creating an attachment service.
 */
interface CreateAttachmentServiceParams {
  /** The type of attachment service to create */
  serviceType: AttachmentServiceType;
  /** Service-specific configuration (can extend later as needed) */
  serviceConfig: CouchAttachmentServiceConfig;
}

/**
 * Creates and returns an instance of IAttachmentService based on the specified service type.
 *
 * This factory function allows for easy instantiation of different attachment service
 * implementations. Currently supports:
 * - CouchDB: Stores attachments as CouchDB document attachments
 *
 * @param params - The parameters for creating the attachment service.
 * @param params.serviceType - The type of service to create (currently only COUCH).
 * @param params.serviceConfig - Configuration specific to the service type.
 * @returns An instance of IAttachmentService.
 * @throws Error if an unsupported service type is specified.
 * @throws Error if required configuration is missing for the specified service type.
 */
export function createAttachmentService({
  serviceType,
  serviceConfig,
}: CreateAttachmentServiceParams): IAttachmentService {
  switch (serviceType) {
    case AttachmentServiceType.COUCH:
      if (!serviceConfig) {
        throw new Error(
          'CouchDB configuration is required for COUCH attachment service'
        );
      }
      return new CouchAttachmentService({
        config: serviceConfig,
      });

    default:
      throw new Error(`Unsupported attachment service type: ${serviceType}`);
  }
}
