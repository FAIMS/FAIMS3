import {
  AttachmentServiceType,
  createAttachmentService,
  DatabaseInterface,
  DataDocument,
  IAttachmentService,
} from '@faims3/data-model';
import {
  ATTACHMENT_DOCUMENT_ID_PREFIX,
  ATTACHMENT_SERVICE_TYPE,
} from '../buildconfig';
import {localGetDataDb} from './database';

/**
 * Creates an attachment service for the given project.
 *
 * This factory function abstracts the attachment service implementation details,
 * allowing the service type to be configured via environment variables.
 *
 * @param projectId - The project ID for which to create the attachment service
 * @returns An IAttachmentService instance configured for the project
 */
export function createProjectAttachmentService(
  projectId: string
): IAttachmentService {
  // Get the data database for this project
  const dataDb = localGetDataDb(projectId) as DatabaseInterface<DataDocument>;

  // Create the attachment service with the configured type
  return createAttachmentService({
    serviceType:
      AttachmentServiceType[
        ATTACHMENT_SERVICE_TYPE as keyof typeof AttachmentServiceType
      ],
    serviceConfig: {
      dataDb,
      documentIdPrefix: ATTACHMENT_DOCUMENT_ID_PREFIX,
    },
  });
}
