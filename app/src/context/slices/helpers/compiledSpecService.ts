/**
 * The compiledSpecService is a singleton class service which allows access to
 * compiled UI Specifications by their identifier in the projects store. This
 * data is not part of the store since it contains runtime JS functions (which
 * are compiled) meaning that it cannot safely be serialised.
 *
 * Note that this is the full {@link NotebookUiSpec} — decoded views (no fviews /
 * encode step), including settings and schemaVersion, with compiled conditionals.
 *
 * NOTE The ID must be unique to the server + project + spec content combo:
 * databaseHelpers' buildCompiledSpecId combines the server and project IDs
 * with a content hash of the uiSpec, so a changed spec gets a new ID and
 * consumers selecting uiSpecificationId re-render onto the new compilation.
 */

import {
  CompiledNotebookUiSpec,
  compileUiSpecConditionals,
  NotebookUiSpec,
} from '@faims3/data-model';
import PouchDB from 'pouchdb-browser';
import PouchDBFind from 'pouchdb-find';
import {reportNotebookCompileFailure} from '../../../logging';
PouchDB.plugin(PouchDBFind);

class CompiledUiSpecService {
  private static instance: CompiledUiSpecService;
  private specs: Map<string, CompiledNotebookUiSpec> = new Map();
  /** Human readable compile failure per spec id (spec is then absent from `specs`). */
  private compileErrors: Map<string, string> = new Map();

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

  /** Why {@link getSpec} returns undefined for `id`, when compilation failed. */
  getCompileError(id: string): string | undefined {
    return this.compileErrors.get(id);
  }

  // Clean up database instances
  removeSpec(id: string): void {
    this.specs.delete(id);
    this.compileErrors.delete(id);
  }

  /**
   * Compile conditionals and register the spec. Never throws: a spec whose
   * conditions / expressions cannot be compiled is recorded in
   * {@link getCompileError} and reported, so the UI can fail soft (skeleton)
   * instead of the whole store update aborting.
   */
  compileAndRegisterSpec(id: string, spec: NotebookUiSpec) {
    try {
      let copy: NotebookUiSpec = JSON.parse(JSON.stringify(spec));
      compileUiSpecConditionals(copy);
      // TODO this is not the tidiest implementation - the spec for the compile function
      this.specs.set(id, copy as CompiledNotebookUiSpec);
      this.compileErrors.delete(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.specs.delete(id);
      this.compileErrors.set(id, message);
      reportNotebookCompileFailure({
        uiSpecificationId: id,
        schemaVersion: spec?.schemaVersion,
        error,
      });
    }
  }
}

export const compiledSpecService = CompiledUiSpecService.getInstance();
