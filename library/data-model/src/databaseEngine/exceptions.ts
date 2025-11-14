// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when document fails validation
 */
export class DocumentValidationError extends Error {
  constructor({
    recordId,
    doc,
    validationErr,
    operation,
  }: {
    recordId: string;
    doc: any;
    validationErr: any;
    operation: string;
  }) {
    // Try and stringify the doc
    let docMsg: string | undefined;
    try {
      docMsg = JSON.stringify(doc, undefined, 2);
    } catch {
      docMsg = undefined;
    }
    super(
      `The target record (id = ${recordId}) failed validation.\nOperation: ${operation}.\nValidation error: ${validationErr}.\nDocument contents:\n${docMsg ?? 'Could not be serialised as JSON...'}.`
    );
    this.name = 'DocumentValidationError';
  }
}

/**
 * Error thrown when revision does not match record
 */
export class RevisionMismatchError extends Error {
  constructor(recordId: string, revisionId: string) {
    super(
      `The target revision ${revisionId} does not belong to the target record ${recordId}.`
    );
    this.name = 'RevisionMismatchError';
  }
}

/**
 * Error thrown when a document is not found in the database
 */
export class DocumentNotFoundError extends Error {
  constructor(id: string, type: string | undefined = undefined) {
    super(`Document with id "${id}" not found.${type ? ' Type: ' + type : ''}`);
    this.name = 'DocumentNotFoundError';
  }
}

/**
 * Error thrown when a document has an unexpected type
 */
export class InvalidDocumentTypeError extends Error {
  constructor(id: string, expectedType: string, actualType: string) {
    super(
      `Document "${id}" is of type "${actualType}", expected "${expectedType}"`
    );
    this.name = 'InvalidDocumentTypeError';
  }
}

/**
 * Error thrown when a record has multiple conflicting heads
 */
export class RecordConflictError extends Error {
  constructor(
    recordId: string,
    public readonly heads: string[]
  ) {
    super(
      `Record "${recordId}" has ${heads.length} conflicting heads: ${heads.join(', ')}`
    );
    this.name = 'RecordConflictError';
  }
}

/**
 * Error thrown when a record has no heads (invalid state)
 */
export class NoHeadsError extends Error {
  constructor(recordId: string) {
    super(`Record "${recordId}" has no heads - invalid state`);
    this.name = 'NoHeadsError';
  }
}

/**
 * Error thrown when a record has an illformed parent revisions
 */
export class MalformedParentsError extends Error {
  constructor(recordId: string, revisionId: string, details: string) {
    super(
      `Record ${recordId}, revision ${revisionId} had a malformed parents array, details: ${details}`
    );
    this.name = 'MalformedParentsError';
  }
}
