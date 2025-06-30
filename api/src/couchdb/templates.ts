import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import {
  ExistingTemplateDocument,
  PostCreateTemplateInput,
  ProjectID,
  PutUpdateTemplateInput,
  TemplateDBFields,
  TemplateDocument,
  TEMPLATES_BY_TEAM_ID,
} from '@faims3/data-model';
import {getTemplatesDb} from '.';
import * as Exceptions from '../exceptions';
import {generateRandomString, slugify} from '../utils';

/**
 * Lists all documents in the templates DB. Returns as TemplateDbDocument. TODO
 * validate with Zod.
 * @returns an array of template objects
 */
export const getTemplates = async ({
  teamId,
}: {
  teamId?: string;
}): Promise<ExistingTemplateDocument[]> => {
  const templatesDb = getTemplatesDb();
  try {
    let resultList;
    if (teamId) {
      resultList = await templatesDb.query<TemplateDBFields>(
        TEMPLATES_BY_TEAM_ID,
        {
          key: teamId,
          include_docs: true,
        }
      );
    } else {
      resultList = await templatesDb.allDocs({
        include_docs: true,
      });
    }
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
 * Gets template IDs by teamID (who owns it)
 * @returns an array of template ids
 */
export const getTemplateIdsByTeamId = async ({
  teamId,
}: {
  teamId: string;
}): Promise<string[]> => {
  const templatesDb = getTemplatesDb();
  try {
    const resultList = await templatesDb.query<TemplateDBFields>(
      TEMPLATES_BY_TEAM_ID,
      {
        key: teamId,
        include_docs: false,
      }
    );
    return resultList.rows
      .filter(res => {
        return !res.id.startsWith('_');
      })
      .map(res => {
        return res.id;
      });
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'An error occurred while reading templates by team ID from the Template DB.'
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
 *
 * Uses MS time + also a random short prefix in case of very very fast or parallel
 * execution
 *
 * @param projectName the project name string
 * @returns a suitable project identifier
 */
const generateTemplateId = (templateName: string): ProjectID => {
  const randomPrefix = generateRandomString(3);
  return `${Date.now().toFixed()}-${randomPrefix}-${slugify(templateName)}`;
};

/**
 * Sets up and lodges a new template record into the template database. Error is
 * thrown under failure to lodge.
 *
 * NOTE this does not add any permissions!
 *
 * @param payload The document details for a template
 * @returns The ID of the minted template
 */
export const createTemplate = async ({
  payload,
}: {
  payload: PostCreateTemplateInput;
}): Promise<ExistingTemplateDocument> => {
  // Get the templates DB so we can interact with it
  const templatesDb = getTemplatesDb();

  // Get a unique id for the template Id
  const templateId = generateTemplateId(payload.name);

  // inject templateId into the metadata
  // TODO see BSS-343
  payload.metadata.template_id = templateId;

  // Setup the document with id included
  const templateDoc: TemplateDocument = {
    _id: templateId,
    version: 1,
    'ui-specification': payload['ui-specification'],
    metadata: {
      ...payload.metadata,
      project_status: 'active',
    },
    ownedByTeamId: payload.teamId,
    name: payload.name,
  };

  // Try putting the new document
  try {
    await templatesDb.put(templateDoc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new template document into the template DB. Exception ' +
        e
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
  payload: PutUpdateTemplateInput
): Promise<ExistingTemplateDocument> => {
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
    ...payload,

    // explicitly retain these details!
    _id: templateId,
    _rev: existingTemplate._rev,
    // Increment version by 1 when updated
    version: existingTemplate.version + 1,
    ownedByTeamId: existingTemplate.ownedByTeamId,
    name: existingTemplate.name,
  } satisfies TemplateDocument;
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
export const archiveTemplate = async (id: string, archive: boolean) => {
  const {get, put} = getTemplatesDb();
  const template = await get(id);

  try {
    await put({
      ...template,
      version: template.version + 1,
      metadata: {
        ...template.metadata,
        project_status: archive ? 'archived' : 'active',
      },
    });
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new template document into the teams DB. Exception ' +
        e
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
