import {EncodedProjectUIModel} from '../../types';

// V1
export type TemplateV1Fields = {
  // Template payload
  metadata: {[key: string]: any};
  'ui-specification': EncodedProjectUIModel;

  // other details
  ownedByTeamId?: string;
};
export type TemplateV1Document = PouchDB.Core.Document<TemplateV1Fields>;

export type TemplateV2Fields = {
  // Template name
  name: string;

  // Template payload
  metadata: {[key: string]: any};
  'ui-specification': EncodedProjectUIModel;

  // other details
  ownedByTeamId?: string;
};

export type TemplateV2Document = PouchDB.Core.Document<TemplateV2Fields>;

// Current (V2)
export type TemplateDBFields = TemplateV2Fields;
export type TemplateDocument = PouchDB.Core.Document<TemplateDBFields>;
export type ExistingTemplateDocument =
  PouchDB.Core.ExistingDocument<TemplateDBFields>;

// DB Type (V2)
export type TemplateDB = PouchDB.Database<TemplateDBFields>;
