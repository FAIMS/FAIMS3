import {getProjectDB} from './sync/index';
import {PROJECT_METADATA_PREFIX, EncodedProjectMetadata} from './datamodel';

export async function getProjectMetadata(
  project_name: string,
  metadata_key: string
): Promise<any> {
  const projdb = getProjectDB(project_name);
  try {
    const doc: EncodedProjectMetadata = await projdb.get(
      PROJECT_METADATA_PREFIX + '-' + metadata_key
    );
    return doc.metadata;
  } catch (err) {
    console.warn(err);
    throw Error('failed to find metadata');
  }
}

export async function setProjectMetadata(
  project_name: string,
  metadata_key: string,
  metadata: any
) {
  const projdb = getProjectDB(project_name);
  try {
    const doc: EncodedProjectMetadata = {
      _id: PROJECT_METADATA_PREFIX + '-' + metadata_key,
      is_attachment: false,
      metadata: metadata,
    };

    try {
      const existing_metaDoc = await projdb.get(
        PROJECT_METADATA_PREFIX + '-' + metadata_key
      );
      doc._rev = existing_metaDoc._rev;
    } catch (err) {
      // Probably no existing UI info
    }

    await projdb.put(doc);
  } catch (err) {
    console.warn(err);
    throw Error('failed to find metadata');
  }
}
