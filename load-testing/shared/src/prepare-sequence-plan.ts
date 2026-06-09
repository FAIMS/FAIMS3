#!/usr/bin/env node
/**
 * Inline collection profile references into a sequence plan JSON file.
 * Used by run-load-test.sh before uploading plans to S3.
 */
import {readFileSync, writeFileSync} from 'fs';
import {resolve} from 'path';
import {resolveCollectionProfilesInPlan} from './resolve-collection-profiles.js';
import {
  parseSequencePlan,
  SEQUENCE_PLAN_FILE_ENV_VAR,
  serializeSequencePlan,
} from './sequence-plan.js';

/** CLI entry: read plan JSON, inline profiles, write prepared output. */
function main(): void {
  const input = process.argv[2];
  const output = process.argv[3];

  if (!input || !output) {
    console.error(
      'Usage: prepare-sequence-plan <input-plan.json> <output-plan.json>'
    );
    process.exit(1);
  }

  const absInput = resolve(input);
  const absOutput = resolve(output);
  const plan = parseSequencePlan(readFileSync(absInput, 'utf8'));

  resolveCollectionProfilesInPlan(plan, {
    ...process.env,
    [SEQUENCE_PLAN_FILE_ENV_VAR]: absInput,
  });

  writeFileSync(absOutput, `${serializeSequencePlan(plan)}\n`, 'utf8');
}

main();
