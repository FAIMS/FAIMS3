import {GLOBAL_MIGRATIONS} from './globalMigrations';
import {DB_MIGRATIONS, DB_TARGET_VERSIONS} from './migrations';
import {DATABASE_TYPES, DatabaseType, MigrationDetails} from './types';

function individualStepAt(
  dbType: DatabaseType,
  fromVersion: number
): MigrationDetails | undefined {
  return DB_MIGRATIONS.find(
    m =>
      m.dbType === dbType &&
      m.from === fromVersion &&
      m.to === fromVersion + 1
  );
}

type OutgoingKind = string;

function outgoingFrom(
  dbType: DatabaseType,
  v: number
): Array<{to: number; kind: OutgoingKind}> {
  const out: Array<{to: number; kind: OutgoingKind}> = [];

  const ind = individualStepAt(dbType, v);
  if (ind) {
    out.push({to: ind.to, kind: `individual(${ind.from}→${ind.to})`});
  }

  for (const g of GLOBAL_MIGRATIONS) {
    for (const p of g.participants) {
      if (p.dbType !== dbType || p.from !== v) {
        continue;
      }
      out.push({to: p.to, kind: `global "${g.id}" (${p.from}→${p.to})`});
    }
  }

  return out;
}

/**
 * Individual rows in {@link DB_MIGRATIONS}: each must be a single +1 step,
 * and there must be no duplicate edges.
 */
export function validateIndividualMigrationNetwork(): void {
  const seenKeys = new Set<string>();

  for (const m of DB_MIGRATIONS) {
    if (m.to !== m.from + 1) {
      throw new Error(
        `Individual migration must advance exactly one version (from=${m.from} to=${m.to}) for ${m.dbType}.`
      );
    }
    const key = `${m.dbType}:${m.from}->${m.to}`;
    if (seenKeys.has(key)) {
      throw new Error(
        `Duplicate individual migration edge ${key}; the migration network must have a unique path.`
      );
    }
    seenKeys.add(key);
  }
}

/**
 * From each database type’s {@link DB_TARGET_VERSIONS} default to target, there
 * must be exactly one acyclic route: at every version `v` with `v < target`,
 * either zero outgoing edges would be unreachable, or more than one would be
 * ambiguous. Outgoing edges are single-step individuals **or** global
 * participant jumps registered in {@link GLOBAL_MIGRATIONS}.
 */
export function validateUniqueReachablePathPerDatabaseType(): void {
  for (const dbType of DATABASE_TYPES) {
    const {defaultVersion, targetVersion} = DB_TARGET_VERSIONS[dbType];
    if (defaultVersion >= targetVersion) {
      continue;
    }

    let v = defaultVersion;
    const visited = new Set<number>();

    while (v < targetVersion) {
      if (visited.has(v)) {
        throw new Error(
          `Migration graph for ${dbType} returned to v${v}; edges must strictly increase version toward v${targetVersion}.`
        );
      }
      visited.add(v);

      const options = outgoingFrom(dbType, v);
      if (options.length === 0) {
        throw new Error(
          `No migration edge from ${dbType} v${v} toward target v${targetVersion}. ` +
            `Add an individual step or a global participant that starts at v${v}.`
        );
      }
      if (options.length > 1) {
        throw new Error(
          `Ambiguous migration from ${dbType} v${v}: multiple outgoing edges (${options.map(o => o.kind).join('; ')}). ` +
            `There must be only one unique path from default to target.`
        );
      }

      const next = options[0].to;
      if (next <= v) {
        throw new Error(
          `Invalid migration edge from ${dbType} v${v}: next version is v${next} (must be greater than v${v}).`
        );
      }
      if (next > targetVersion) {
        throw new Error(
          `Migration from ${dbType} v${v} jumps to v${next}, past target v${targetVersion}.`
        );
      }
      v = next;
    }

    if (v !== targetVersion) {
      throw new Error(
        `Internal error: ${dbType} migration walk ended at v${v} but target is v${targetVersion}.`
      );
    }
  }
}

/**
 * Each global migration must own the full version interval on every
 * participant: no individual single-step may exist for any intermediate version,
 * otherwise the resolver could take a non-unique route.
 */
export function validateGlobalMigrationsAgainstIndividuals(): void {
  const seenIds = new Set<string>();

  for (const g of GLOBAL_MIGRATIONS) {
    if (seenIds.has(g.id)) {
      throw new Error(`Duplicate global migration id "${g.id}".`);
    }
    seenIds.add(g.id);

    const participantDbTypes = new Set<string>();
    for (const p of g.participants) {
      if (participantDbTypes.has(p.dbType)) {
        throw new Error(
          `Global migration "${g.id}" lists ${p.dbType} more than once in participants. Each database type may appear only once so matching is deterministic by type.`
        );
      }
      participantDbTypes.add(p.dbType);
    }

    for (const p of g.participants) {
      if (p.to <= p.from) {
        throw new Error(
          `Global migration "${g.id}" has invalid participant ${p.dbType} (${p.from} -> ${p.to}).`
        );
      }
      for (let ver = p.from; ver < p.to; ver++) {
        if (individualStepAt(p.dbType, ver)) {
          throw new Error(
            `Global migration "${g.id}" participant ${p.dbType} spans v${p.from}→v${p.to}, but an individual migration exists for v${ver}→v${ver + 1}. ` +
              `Remove overlapping individuals or narrow the global range so the network has a unique path.`
          );
        }
      }
    }
  }
}

/**
 * Validates {@link DB_MIGRATIONS} and {@link GLOBAL_MIGRATIONS} together:
 * well-formed individual edges, no overlap between globals and individuals inside
 * a global’s participant span, duplicate global ids, and a **unique** path from
 * each type’s default version to its target using only those edges.
 *
 * Runtime subset checks for globals live in
 * {@link assertGlobalMigrationCoversEveryStaleParticipantDbInBatch}.
 */
export function validateConfiguredMigrationNetwork(): void {
  validateIndividualMigrationNetwork();
  validateGlobalMigrationsAgainstIndividuals();
  validateUniqueReachablePathPerDatabaseType();
}
