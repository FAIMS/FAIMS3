/**
 * The compiledSpecService is a singleton class service which allows access to
 * compiled UI Specifications by their identifier in the projects store. This
 * data is not part of the store since it contains runtime JS functions (which
 * are compiled) meaning that it cannot safely be serialised.
 *
 * Note that this is the full {@link NotebookUiSpec} — decoded views (no fviews /
 * encode step), including settings and schemaVersion, with compiled conditionals.
 *
 * NOTE The ID used here is arbitrary so long as it unique to the server +
 * project combo. To this end, databaseHelpers has a buildCompiledSpecId
 * function which takes the server and project and combines them to form an ID.
 */

import {compileUiSpecConditionals, NotebookUiSpec} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
PouchDB.plugin(PouchDBFind);

class CompiledUiSpecService {
  private static instance: CompiledUiSpecService;
  private specs: Map<string, NotebookUiSpec> = new Map();

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
  compileAndRegisterSpec(id: string, spec: NotebookUiSpec) {
    const copy: NotebookUiSpec = JSON.parse(JSON.stringify(spec));
    compileUiSpecConditionals(copy);
    this.specs.set(id, copy);
  }
}

export const compiledSpecService = CompiledUiSpecService.getInstance();
