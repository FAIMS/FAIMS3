import {
  ProjectID,
  TemplateDocument,
  TemplateEditableDetails,
} from '@faims3/data-model';
import PouchDB from 'pouchdb';
import securityPlugin from 'pouchdb-security-helper';
import {getTemplatesDb} from '.';
import {slugify} from '../utils';
import * as Exceptions from '../exceptions';
PouchDB.plugin(securityPlugin);

/**
 * Lists all documents in the templates DB. Returns as TemplateDbDocument. TODO
 * validate with Zod.
 * @returns an array of template objects
 */
export const getTemplates = async (): Promise<TemplateDocument[]> => {
  const templatesDb = getTemplatesDb();
  try {
    const resultList = await templatesDb.allDocs({
      include_docs: true,
    });
    return resultList.rows
      .filter(document => {
        return !!document.doc && !document.id.startsWith('_');
      })
      .map(document => {
        return document.doc!;
      });
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading templates from the Template DB.'
    );
  }
};

/**
 * Fetches a template by id
 * @param id The ID of the template to retrieve
 * @returns The document if available
 */
export const getTemplate = async (id: string) => {
  const templatesDb = getTemplatesDb();
  try {
    return await templatesDb.get(id);
  } catch (error) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while reading templates from the Template DB. Are you sure the ID is correct?'
    );
  }
};

/**
 * Generate a good project identifier for a new project
 * @param projectName the project name string
 * @returns a suitable project identifier
 */
const generateTemplateId = (templateName: string): ProjectID => {
  return `${Date.now().toFixed()}-${slugify(templateName)}`;
};

/**
 * Sets up and lodges a new template record into the template database. Error is
 * thrown under failure to lodge.
 * @param payload The document details for a template
 * @returns The ID of the minted template
 */
export const createTemplate = async (
  payload: TemplateEditableDetails
): Promise<TemplateDocument> => {
  // Get the templates DB so we can interact with it
  const templatesDb = getTemplatesDb();

  // Get a unique id for the template Id
  const templateId = generateTemplateId(payload.template_name);

  // inject templateId into the metadata
  // TODO see BSS-343
  payload.metadata.template_id = templateId;

  // Setup the document with id included
  const templateDoc: TemplateDocument = {
    _id: templateId,
    version: 1,
    ...payload,
    metadata: {
      ...payload.metadata,
      project_status: 'active',
    },
  };

  // Try putting the new document
  try {
    await templatesDb.put(templateDoc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new template document into the templates DB.'
    );
  }

  // Then return the fetched result
  try {
    return await templatesDb.get(templateId);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to GET the new template document from the templates DB.'
    );
  }
};

/**
 * Fetches existing template by ID, replaces the details, and puts back with
 * latest revision included. Returns the new revision. Throws an exception if
 * the fetch fails or the update.
 * @param templateId The existing template Id to update
 * @param payload The payload to replace it with - details only
 * @returns The revision ID of the new version of the document
 */
export const updateExistingTemplate = async (
  templateId: string,
  payload: TemplateEditableDetails
): Promise<TemplateDocument> => {
  // Now fetch the existing template - this will allow us to get the latest
  // revision etc
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to update with new details. Are you sure the ID is correct?'
    );
  }

  // Now on the new put, we make sure to include the _rev of previous document which allows replacement
  const templateDb = getTemplatesDb();

  // inject templateId into the metadata - we have to do this here because a
  // user could potentially change the metadata
  // TODO see BSS-343
  payload.metadata.template_id = templateId;

  const newDocument = {
    _id: templateId,
    _rev: existingTemplate._rev,
    // Increment version by 1 when updated
    version: existingTemplate.version + 1,
    ...payload,
  };
  try {
    await templateDb.put(newDocument);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to update an existing template.'
    );
  }
  try {
    return await templateDb.get(templateId);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to fetch the updated template.'
    );
  }
};

/**
 * Removes the latest revision of a template from the templates DB by fetching
 * it then deleting that document.
 * @param templateId The ID of the existing template to remove - deletes the
 * latest revision.
 */
export const deleteExistingTemplate = async (templateId: string) => {
  const templatesDb = getTemplatesDb();
  // Now fetch the existing template - this will allow us to get the latest
  // revision etc
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to remove it. Are you sure the ID is correct?'
    );
  }

  try {
    await templatesDb.remove(existingTemplate);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to delete an existing template.'
    );
  }
};

/**
 * Archives a template by incrementing the version and setting the project_status to archived.
 * @param id The ID of the template to archive.
 * @returns The updated template document.
 */
export const archiveTemplate = async (id: string) => {
  const {get, put} = getTemplatesDb();
  const template = await get(id);

  try {
    await put({
      ...template,
      version: template.version + 1,
      metadata: {
        ...template.metadata,
        project_status: 'archived',
      },
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new template document into the templates DB.'
    );
  }

  try {
    return await get(id);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to fetch the updated template.'
    );
  }
};
