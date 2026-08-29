import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);
PouchDB.plugin(require('pouchdb-security-helper'));

import type {
  NotebookDefinition,
  RegisteredPlan,
  TemplateApiDocument,
  TemplateApiListItem,
} from '@faims3/data-model';
import {
  ExistingTemplateDocument,
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
  getPlanTypeDefinition,
  normalizeNotebookTemplateUiSpecification,
  normalizeRootDescriptionForStore,
  notebookUiSpecificationValidationMessage,
} from '@faims3/data-model';
import {getTemplatesDb} from '.';
import * as Exceptions from '../exceptions';
import {nowIso} from '../time';
import {generateRandomString} from '../utils';
import {
  clearTemplateIdFromProjectsReferencingTemplate,
  createNotebook,
} from './notebooks';
import {getTeamById} from './teams';
import {stripTemplateRolesForTemplateId} from './users';

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
      ? await templatesDb.query<TemplateListItem>(
          TEMPLATES_LISTING_BY_TEAM_ID,
          {
            key: teamId,
            include_docs: false,
          }
        )
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

async function teamDisplayNameForId(
  teamId: string
): Promise<string | undefined> {
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
 *
 * @param payload The document details for a template
 * @returns The ID of the minted template
 */
export const createTemplate = async ({
  payload,
  createdBy,
}: {
  payload: PostCreateTemplateInput;
  createdBy: string;
}): Promise<ExistingTemplateDocument> => {
  // Get the templates DB so we can interact with it
  const templatesDb = getTemplatesDb();

  // Get a unique id for the template Id
  const templateId = generateTemplateId(payload.name);

  // if there is a team id provided, it must be an actual team
  if (payload.teamId) {
    try {
      await getTeamById(payload.teamId);
    } catch (error) {
      throw new Exceptions.InternalSystemError(
        'The specified team ID does not exist.'
      );
    }
  }

  // Setup the document with id included
  const now = nowIso();
  let uiSpecification;
  try {
    uiSpecification = normalizeNotebookTemplateUiSpecification(
      payload.uiSpecification
    );
  } catch (error) {
    throw new Exceptions.ValidationException(
      notebookUiSpecificationValidationMessage(error)
    );
  }
  const templateDoc: TemplateDocument = {
    _id: templateId,
    version: 1,
    archived: false,
    isPublic: payload.isPublic ?? false,
    uiSpecification,
    ownedByTeamId: payload.teamId,
    name: payload.name,
    description: normalizeRootDescriptionForStore(payload.description),
    createdBy,
    createdAt: now,
    updatedAt: now,
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
 * Merges inconsequential root fields on an existing template (name, description).
 *
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

  const newDocument: TemplateDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    name: payload.name ?? existingTemplate.name,
    description:
      payload.description !== undefined
        ? normalizeRootDescriptionForStore(payload.description)
        : existingTemplate.description,
    updatedAt: nowIso(),
  };

  // Now on the new put, we make sure to include the _rev of previous document which allows replacement
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
  // Now fetch the existing template - this will allow us to get the latest
  // revision etc
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template in order to change its team. Are you sure the ID is correct?'
    );
  }

  // check that it is a valid team
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

  // Now on the new put, we make sure to include the _rev of previous document which allows replacement
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
  uiSpecification:
    | PutUpdateTemplateUiSpecificationInput
    | NotebookUiSpecificationInput
): Promise<ExistingTemplateDocument> => {
  let normalizedUiSpecification;
  try {
    normalizedUiSpecification =
      normalizeNotebookTemplateUiSpecification(uiSpecification);
  } catch (error) {
    throw new Exceptions.ValidationException(
      notebookUiSpecificationValidationMessage(error)
    );
  }
  // Now fetch the existing template - this will allow us to get the latest
  // revision etc
  let existingTemplate;
  try {
    existingTemplate = await getTemplate(templateId);
  } catch (e) {
    throw new Exceptions.ItemNotFoundException(
      'An error occurred while trying to fetch an existing template. Are you sure the ID is correct?'
    );
  }

  // Now on the new put, we make sure to include the _rev of previous document which allows replacement
  const templateDb = getTemplatesDb();
  const newDocument: TemplateDocument = {
    ...existingTemplate,
    _id: templateId,
    _rev: existingTemplate._rev,
    uiSpecification: normalizedUiSpecification,
    // Increment version by 1 when updated
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

/**
 * Create a notebook from a template, instantiating each of the template's plan
 * templates. Every plan template needs its own config, keyed by the plan id, so
 * the plan's per-notebook values are supplied at creation.
 */
export const createNotebookFromTemplate = async ({
  template,
  projectName,
  description,
  createdBy,
  teamId,
  planConfigs,
}: {
  template: ExistingTemplateDocument;
  projectName: string;
  description?: string;
  createdBy: string;
  teamId?: string;
  planConfigs?: Record<string, Record<string, unknown>>;
}) => {
  if (template.archived === true) {
    throw new Exceptions.InvalidRequestException(
      'Cannot create a notebook from an archived template.'
    );
  }

  // create the proto notebook definition from the template's uiSpecification
  const uiSpecification: NotebookDefinition = {
    metadata: {...template.uiSpecification.metadata},
    uiSpec: template.uiSpecification.uiSpec,
  };

  const plans: RegisteredPlan[] = [];
  const planTemplates = template.uiSpecification.planTemplates ?? [];

  // A config for a plan the template does not carry means the caller read a
  // different version of it, so its other configs may target the wrong plans.
  const planIds = new Set(planTemplates.map(p => p.planId));
  const stale = Object.keys(planConfigs ?? {}).filter(id => !planIds.has(id));
  if (stale.length > 0) {
    throw new Exceptions.InvalidRequestException(
      `The template ${template._id} has no plan ${stale.map(id => `"${id}"`).join(', ')}; the plan configs do not match the template.`
    );
  }

  // Instantiate every plan template the template carries, in declared order,
  // which is the order the app offers them in.
  for (const planTemplate of planTemplates) {
    const {planId, planType} = planTemplate;
    // Get the instantiation function for this plan type
    const planTypeDefinition = getPlanTypeDefinition(planType);
    if (!planTypeDefinition) {
      throw new Exceptions.InternalSystemError(
        `Cannot create a notebook from template ${template._id} because its plan template "${planId}" is of type ${planType}, which is not recognised.`
      );
    }
    // validate the planTemplate before we use it
    const planTemplateValidationResult =
      planTypeDefinition.templateSchema.safeParse(planTemplate);
    if (!planTemplateValidationResult.success) {
      throw new Exceptions.InternalSystemError(
        `Cannot create a notebook from template ${template._id} because its plan template "${planId}" of type ${planType} is invalid: ${planTemplateValidationResult.error.message}`
      );
    }

    // we need the config payload for this plan template, defined by
    // the configSchema property of the plan template
    const planConfig = planConfigs?.[planId];
    if (!planConfig) {
      throw new Exceptions.InvalidRequestException(
        `The template ${template._id} has a plan template "${planId}" of type ${planType}, so a plan config must be provided for it.`
      );
    }
    // validate the config against the plan type's config schema
    const configValidationResult =
      planTypeDefinition.configSchema.safeParse(planConfig);
    if (!configValidationResult.success) {
      throw new Exceptions.InvalidRequestException(
        `The plan config provided for plan "${planId}" of type ${planType} is invalid: ${configValidationResult.error.message}`
      );
    }

    // call the plan creator for this plan type
    const instantiatedPlan = planTypeDefinition.instantiatePlan({
      template: planTemplate,
      config: configValidationResult.data,
    });

    // insert the plan into the uiSpecification for the notebook we're creating
    // parse it first to make sure it's valid according to the plan type's plan schema
    const planParseResult = planTypeDefinition.planSchema.safeParse({
      ...instantiatedPlan,
      // The template owns both: `instantiatePlan` writes neither.
      planId,
      ...(planTemplate.label ? {label: planTemplate.label} : {}),
    });
    if (!planParseResult.success) {
      throw new Exceptions.InvalidRequestException(
        `The instantiated plan "${planId}" of type ${planType} is invalid: ${planParseResult.error.message}`
      );
    }
    plans.push(planParseResult.data);
  }

  if (plans.length > 0) {
    uiSpecification.plans = plans;
  }

  return await createNotebook({
    projectName,
    uiSpecification: uiSpecification,
    description: description,
    templateId: template._id,
    teamId: teamId,
    createdBy: createdBy,
  });
};
