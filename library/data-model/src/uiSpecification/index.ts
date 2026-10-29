// SPDX-License-Identifier: Apache-2.0
export * from './conditionals';
export * from './utils';
export * from './types';
export * from './schemaVersion';
export * from './schemaCompatibility';
export * from './normalize';
export * from './expressions';
export * from './parentForms';
export * from './relatedForms';
export * from './formScan';
export * from './parentReferences';
export * from './metadataReferences';
// Named re-exports: tsc incremental has dropped `export *` from the JS
// barrels (not the .d.ts), which makes Rollup miss EXPRESSION_CONSTANTS.
export {
  CONSTANT_REFERENCE_PREFIX,
  decodeConstantRef,
  encodeConstantRef,
  EXPRESSION_CONSTANT_NAMES,
  EXPRESSION_CONSTANTS,
  isConstantRef,
} from './expressionConstants';
export * from './uiSpecProperties';
