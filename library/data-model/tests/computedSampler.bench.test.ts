// SPDX-License-Identifier: Apache-2.0
/**
 * Read benchmark over the Computed Sampler notebook. Skipped unless
 * COMPUTED_BENCH is set, so it never runs in CI:
 *
 *   COMPUTED_BENCH=1 npx jest computedSampler.bench --silent
 *
 * Times the three read paths a computed value is served through: a single
 * record read (the app opening a record), the list read (hydration) and the
 * export iterator. Every path is warmed first and each figure is the median
 * of RUNS passes. Sizes are set by the BENCH_* variables below.
 */
import {DataDbType, DataEngine, notebookRecordIterator} from '../src';
import {
  CALIBRATION_PAIR,
  createFeature,
  createSamplerEngine,
  createSamplerRecord,
  SAMPLE_PAIR,
  SAMPLER_PROJECT,
  setSamplerValues,
  singleLinkTo,
} from './computedSamplerTestSupport';

const size = (name: string, fallback: number) =>
  Number(process.env[name] ?? fallback);

const SITES = size('BENCH_SITES', 20);
const FEATURES_PER_SITE = size('BENCH_FEATURES_PER_SITE', 25);
const CALIBRATIONS = size('BENCH_CALIBRATIONS', 10);
const TESTS_PER_CALIBRATION = size('BENCH_TESTS_PER_CALIBRATION', 20);
const CHAIN_LENGTH = size('BENCH_CHAIN_LENGTH', 30);
const RUNS = size('BENCH_RUNS', 3);

const bench = process.env.COMPUTED_BENCH ? describe : describe.skip;

bench('Computed Sampler benchmark', () => {
  const report: string[] = [];

  /** Runs `run` RUNS times and records the median, in total and per record. */
  const time = async (
    label: string,
    count: number,
    run: () => Promise<void>
  ) => {
    const samples: number[] = [];
    for (let i = 0; i < RUNS; i++) {
      const started = performance.now();
      await run();
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)];
    report.push(
      `${label.padEnd(44)} ${median.toFixed(0).padStart(7)} ms  ` +
        `${(median / count).toFixed(2).padStart(7)} ms/record  (${count})`
    );
  };

  const readEach = (engine: DataEngine, recordIds: string[]) => async () => {
    for (const recordId of recordIds) {
      await engine.form.getExistingFormData({recordId});
    }
  };

  const listAll = (engine: DataEngine, formId: string) => async () => {
    let startKey: string | undefined;
    do {
      const page = await engine.form.listHydratedRecords({
        projectId: SAMPLER_PROJECT,
        formId,
        limit: 100,
        startKey,
      });
      startKey = page.nextStartKey;
    } while (startKey !== undefined);
  };

  it(
    'times the read paths',
    async () => {
      const {db, engine, uiSpec} = await createSamplerEngine(
        'bench-computed-sampler-db'
      );

      const exportAll = async () => {
        const iterator = await notebookRecordIterator({
          dataDb: db as unknown as DataDbType,
          projectId: SAMPLER_PROJECT,
          uiSpecification: uiSpec,
          includeAttachments: false,
          engine,
        });
        let {done} = await iterator.next();
        while (!done) {
          ({done} = await iterator.next());
        }
      };

      const featureIds: string[] = [];
      for (let s = 0; s < SITES; s++) {
        const siteId = await createSamplerRecord(engine, 'Site', {
          'Site-Name': `S${s}`,
          'Site-Area': 10 + s,
          'Site-Scale': 2,
        });
        let siteLinks: unknown;
        for (let f = 0; f < FEATURES_PER_SITE; f++) {
          const feature = await createFeature(
            engine,
            siteId,
            {
              'Feature-Name': `S${s}-F${f}`,
              'Feature-Count': 30 + f,
              'Feature-Depth': 4,
            },
            siteLinks
          );
          siteLinks = feature.siteLinks;
          featureIds.push(feature.recordId);
        }
        await setSamplerValues(engine, siteId, {'Site-Features': siteLinks});
      }

      const testIds: string[] = [];
      for (let c = 0; c < CALIBRATIONS; c++) {
        const calibrationId = await createSamplerRecord(engine, 'Calibration', {
          'Cutter-ID': `C${c}`,
          'Cutter-Mass-g': 50,
          'Tare-g': 10,
        });
        for (let t = 0; t < TESTS_PER_CALIBRATION; t++) {
          testIds.push(
            await createSamplerRecord(engine, 'Test', {
              'Test-Name': `C${c}-T${t}`,
              'Wet-Mass-g': 100 + t,
              'Core-Calibration': singleLinkTo(calibrationId, CALIBRATION_PAIR),
            })
          );
        }
      }

      const sampleIds: string[] = [];
      for (let i = 0; i < CHAIN_LENGTH; i++) {
        sampleIds.push(
          await createSamplerRecord(engine, 'Sample', {
            'Sample-Name': `S${i}`,
            'Sample-Increment': 1,
            ...(i > 0
              ? {
                  'Previous-Sample': singleLinkTo(
                    sampleIds[i - 1],
                    SAMPLE_PAIR
                  ),
                }
              : {}),
          })
        );
      }

      // Warm every path first. The first list or export query builds a view
      // index over the whole database, which would swamp the measurement.
      await readEach(engine, featureIds.slice(0, 20))();
      await listAll(engine, 'Feature')();
      await exportAll();

      await time(
        'single read: Feature (parent refs)',
        featureIds.length,
        readEach(engine, featureIds)
      );
      await time(
        'single read: Test (linked ref)',
        testIds.length,
        readEach(engine, testIds)
      );
      await time(
        'single read: Sample (self-reference chain)',
        sampleIds.length,
        readEach(engine, sampleIds)
      );
      await time(
        'list read: Feature',
        featureIds.length,
        listAll(engine, 'Feature')
      );
      await time('list read: Test', testIds.length, listAll(engine, 'Test'));
      await time(
        'export iterator: all forms',
        featureIds.length + testIds.length + sampleIds.length,
        exportAll
      );

      // Written straight to stdout so --silent can hide the engine's own logs
      process.stdout.write(
        [
          '',
          `Computed Sampler benchmark: ${SITES} sites x ${FEATURES_PER_SITE} features, ` +
            `${CALIBRATIONS} calibrations x ${TESTS_PER_CALIBRATION} tests, ` +
            `chain of ${CHAIN_LENGTH}, median of ${RUNS}`,
          ...report,
          '',
        ].join('\n')
      );
      await db.destroy();
    },
    15 * 60 * 1000
  );
});
