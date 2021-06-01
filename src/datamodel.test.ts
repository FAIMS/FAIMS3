import {testProp, fc} from 'jest-fast-check';
import {
  resolve_observation_id,
  split_full_observation_id,
  SplitObservationID,
} from './datamodel';

testProp('not a full observation id errors', [fc.fullUnicodeString()], id => {
  fc.pre(!id.includes('||'));
  expect(() => split_full_observation_id(id)).toThrow(
    'Not a valid full observation id'
  );
});

testProp(
  'full observation id works',
  [fc.fullUnicodeString(), fc.fullUnicodeString()],
  (project_id, observation_id) => {
    fc.pre(project_id.trim() !== '');
    fc.pre(observation_id.trim() !== '');

    const split_id = {
      project_id: project_id,
      observation_id: observation_id,
    };
    expect(split_full_observation_id(resolve_observation_id(split_id))).toEqual(
      split_id
    );
  }
);
