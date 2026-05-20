import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import {
  ExistingTemplateDocument,
  NotebookDefinition,
  NotebookUiSpecificationInput,
  PostCreateTemplateInput,
  ProjectID,
  PutChangeTemplateTeamInput,
  PutUpdateTemplateInput,
  PutUpdateTemplateUiSpecificationInput,
  safeWriteDocument,
  slugify,
  TemplateDBFields,
  TemplateDocument,
  TemplateListItem,
  TEMPLATES_BY_TEAM_ID,
  TEMPLATES_LISTING_BY_TEAM_ID,
  TEMPLATES_LISTING_BY_TEMPLATE_ID,
} from '@faims3/data-model';
import {normalizeUiSpecificationOrThrow} from './normalizeUiSpecification';
import type {
  TemplateApiDocument,
  TemplateApiListItem,
} from '@faims3/data-model';
import {getTemplatesDb} from '.';
import * as Exceptions from '../exceptions';
import {generateRandomString} from '../utils';
import {clearTemplateIdFromProjectsReferencingTemplate} from './notebooks';
import {getTeamById} from './teams';
import {stripTemplateRolesForTemplateId} from './users';

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Lists templates using CouchDB views whose map `value` is the template doc
 * without `uiSpecification`. Uses `include_docs: false` on purpose: with
 * `include_docs: true`, CouchDB would also attach the full stored document for
 * each row (including `uiSpecification`), which would defeat the lean list.
 *
 * @returns an array of template list items (from each row's `value`)
 */
export const getTemplates = async ({
  teamId,
}: {
  teamId?: string;
}): Promise<TemplateListItem[]> => {
  const templatesDb = getTemplatesDb();
  try {
    const resultList = teamId
      ? await templatesDb.query<TemplateListItem>(TEMPLATES_LISTING_BY_TEAM_ID, {
          key: teamId,
          include_docs: false,
        })
      : await templatesDb.query<TemplateListItem>(
          TEMPLATES_LISTING_BY_TEMPLATE_ID,
          {
            include_docs: false,
          }
        );
    return resultList.rows
      .filter(row => row.value != null && row.id && !row.id.startsWith('_'))
      .map(row => row.value!);
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
export const getTemplate = async (
  id: string
): Promise<ExistingTemplateDocument> => {
  const templatesDb = getTemplatesDb();
  try {
    return await templatesDb.get(id);
  } catch (error) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while reading templates from the Template DB. Are you sure the ID is correct?'
    );
  }
};

async function teamDisplayNameForId(teamId: string): Promise<string | undefined> {
  try {
    const team = await getTeamById(teamId);
    return team.name;
  } catch {
    return undefined;
  }
}

/**
 * Adds {@link TemplateApiDocument.ownedByTeamDisplayName} for API responses so
 * clients can show the team name without calling the teams API.
 */
export async function withOwnedByTeamDisplayName(
  template: ExistingTemplateDocument
): Promise<TemplateApiDocument>;
export async function withOwnedByTeamDisplayName(
  template: TemplateListItem
): Promise<TemplateApiListItem>;
export async function withOwnedByTeamDisplayName(
  template: TemplateListItem | ExistingTemplateDocument
): Promise<TemplateApiListItem | TemplateApiDocument> {
  if (!template.ownedByTeamId) {
    return template;
  }
  const ownedByTeamDisplayName = await teamDisplayNameForId(
    template.ownedByTeamId
  );
  return ownedByTeamDisplayName !== undefined
    ? {...template, ownedByTeamDisplayName}
    : template;
}

export async function withOwnedByTeamDisplayNames(
  templates: TemplateListItem[] | ExistingTemplateDocument[]
): Promise<TemplateApiListItem[] | TemplateApiDocument[]> {
  const ids = [
    ...new Set(
      templates
        .map(t => t.ownedByTeamId)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)
    ),
  ];
  const nameById = new Map<string, string>();
  await Promise.all(
    ids.map(async id => {
      const name = await teamDisplayNameForId(id);
      if (name !== undefined) {
        nameById.set(id, name);
      }
    })
  );
  return templates.map(t => {
    if (!t.ownedByTeamId) {
      return t;
    }
    const ownedByTeamDisplayName = nameById.get(t.ownedByTeamId);
    return ownedByTeamDisplayName !== undefined
      ? {...t, ownedByTeamDisplayName}
      : t;
  });
}

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
 */
export const createTemplate = async ({
  payload,
  createdBy,
}: {
  payload: PostCreateTemplateInput;
  createdBy: string;
}): Promise<ExistingTemplateDocument> => {
  const templatesDb = getTemplatesDb();
  const templateId = generateTemplateId(payload.name);

  if (payload.teamId) {
    try {
      await getTeamById(payload.teamId);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'The specified team ID does not exist.'
      );
    }
  }

  const now = nowIso();
  const uiSpecification = normalizeUiSpecificationOrThrow(payload.uiSpecification);
  const templateDoc: TemplateDocument = {
    _id: templateId,
    version: 1,
    archived: false,
    isPublic: payload.isPublic ?? false,
    uiSpecification,
    ownedByTeamId: payload.teamId,
    name: payload.name,
    description: payload.description ?? '',
    createdBy,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await templatesDb.put(templateDoc);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to PUT the new template document into the template DB. Exception ' +
        e
    );
  }

  try {
    return await templatesDb.get(templateId);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to GET the new template document from the templates DB.'
    );
  }
};

/**
 * Merges inconsequential root fields on an existing template (name, description).
 */
export const updateExistingTemplate = async (
  templateId: string,
  payload: PutUpdateTemplateInput
): Promise<ExistingTemplateDocument> => {
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to update with new details. Are you sure the ID is correct?'
    );
  }

  const newDocument: TemplateDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    name: payload.name ?? existingTemplate.name,
    description: payload.description ?? existingTemplate.description,
    updatedAt: nowIso(),
  };

  const templateDb = getTemplatesDb();
  try {
    await safeWriteDocument({db: templateDb, data: newDocument});
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
 * Updates the team associated with a template.
 */
export const changeTemplateTeam = async (
  templateId: string,
  payload: PutChangeTemplateTeamInput
): Promise<ExistingTemplateDocument> => {
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to change its team. Are you sure the ID is correct?'
    );
  }

  try {
    await getTeamById(payload.teamId);
  } catch (error) {
    throw new Exceptions.InternalSystemError(
      'The specified team ID does not exist.'
    );
  }

  const newDocument: TemplateDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    ownedByTeamId: payload.teamId,
    updatedAt: nowIso(),
  };

  const templateDb = getTemplatesDb();
  try {
    await safeWriteDocument({db: templateDb, data: newDocument});
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to update the template team.'
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
 * Replaces the full uiSpecification bundle and bumps version.
 */
export const updateTemplateUiSpecification = async (
  templateId: string,
  uiSpecification: PutUpdateTemplateUiSpecificationInput | NotebookUiSpecificationInput
): Promise<ExistingTemplateDocument> => {
  const normalizedUiSpecification =
    normalizeUiSpecificationOrThrow(uiSpecification);
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template. Are you sure the ID is correct?'
    );
  }

  const templateDb = getTemplatesDb();
  const newDocument: TemplateDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    uiSpecification: normalizedUiSpecification,
    version: existingTemplate.version + 1,
    updatedAt: nowIso(),
  };

  try {
    await safeWriteDocument({db: templateDb, data: newDocument});
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to update template uiSpecification.'
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
 * Sets public visibility only (does not change name, ui-spec, etc.).
 */
export const setTemplateVisibility = async (
  templateId: string,
  isPublic: boolean
): Promise<ExistingTemplateDocument> => {
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template. Are you sure the ID is correct?'
    );
  }

  const templateDb = getTemplatesDb();
  const newDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    isPublic,
    updatedAt: nowIso(),
  } satisfies TemplateDocument;

  try {
    await safeWriteDocument({db: templateDb, data: newDocument});
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to update template visibility.'
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
 */
export const deleteExistingTemplate = async (templateId: string) => {
  const templatesDb = getTemplatesDb();
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to remove it. Are you sure the ID is correct?'
    );
  }

  if (existingTemplate.archived !== true) {
    throw new Exceptions.InvalidRequestException(
      'Only archived templates can be permanently deleted. Archive the template first, then delete it from the Archive view.'
    );
  }

  await clearTemplateIdFromProjectsReferencingTemplate(templateId);
  await stripTemplateRolesForTemplateId(templateId);

  try {
    await templatesDb.remove(existingTemplate);
  } catch (e) {
    throw new Exceptions.InternalSystemError(
      'An unexpected error occurred while trying to delete an existing template.'
    );
  }
};

/**
 * Archives or un-archives a template (top-level `archived` flag).
 */
export const archiveTemplate = async (id: string, archive: boolean) => {
  const {get, put} = getTemplatesDb();
  const template = await get(id);

  try {
    await put({
      ...template,
      version: template.version + 1,
      archived: archive,
      updatedAt: nowIso(),
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

/**
 * Restores an archived template (sets archived to false). Rejected if not archived.
 */
export const restoreTemplateFromArchive = async (id: string) => {
  const template = await getTemplate(id);
  if (template.archived !== true) {
    throw new Exceptions.InvalidRequestException(
      'Only archived templates can be restored.'
    );
  }
  return archiveTemplate(id, false);
};
