/**
 * The compiledSpecService is a singleton class service which allows access to
 * compiled UI Specifications by their identifier in the projects store. This
 * data is not part of the store since it contains runtime JS functions (which
 * are compiled) meaning that it cannot safely be serialised.
 *
 * Note that is the ProjectUIModel - not the Encoded model (e.g. with fviews)
 */

import {ProjectUIModel} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import {compileUiSpecConditionals} from '../../../uiSpecification';
PouchDB.plugin(PouchDBFind);

// Singleton service to manage database instances
class CompiledUiSpecService {
  private static instance: CompiledUiSpecService;
  private specs: Map<string, ProjectUIModel> = new Map();

  private constructor() {}

  static getInstance(): CompiledUiSpecService {
    if (!CompiledUiSpecService.instance) {
      CompiledUiSpecService.instance = new CompiledUiSpecService();
    }
    return CompiledUiSpecService.instance;
  }

  // Create or get existing database instance
  getSpec(id: string) {
    return this.specs.get(id);
  }

  // Clean up database instances
  removeSpec(id: string): void {
    this.specs.delete(id);
  }

  // Create or get existing database instance
  compileAndRegisterSpec(id: string, spec: ProjectUIModel) {
    const copy: ProjectUIModel = JSON.parse(JSON.stringify(spec));
    compileUiSpecConditionals(copy);
    this.specs.set(id, copy);
  }
}

export const compiledSpecService = CompiledUiSpecService.getInstance();
