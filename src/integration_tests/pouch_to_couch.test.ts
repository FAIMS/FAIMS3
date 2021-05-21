import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
} from '../buildconfig';
import {
  initialize,
  projects_dbs,
  people_dbs,
  data_dbs,
  metadata_dbs,
} from '../sync';

const COUCHDB_USER = process.env.COUCHDB_USER || null;
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || null;

jest.setTimeout(1000 * 10);

test('talk to couch', async () => {
  const url =
    encodeURIComponent(DIRECTORY_PROTOCOL) +
    '://' +
    encodeURIComponent(DIRECTORY_HOST) +
    ':' +
    encodeURIComponent(DIRECTORY_PORT);
  const response = await fetch(url);
  expect(response.ok).toBe(true);
});

test('send to couch', async () => {
  const base_url =
    encodeURIComponent(DIRECTORY_PROTOCOL) +
    '://' +
    (COUCHDB_USER === null
      ? ''
      : encodeURIComponent(COUCHDB_USER) +
        (COUCHDB_PASSWORD === null
          ? ''
          : ':' + encodeURIComponent(COUCHDB_PASSWORD)) +
        '@') +
    encodeURIComponent(DIRECTORY_HOST) +
    ':' +
    encodeURIComponent(DIRECTORY_PORT);
  const data = {
    test: 'test',
  };
  let response = await fetch(base_url + '/test_db', {
    method: 'PUT',
  });
  expect(response.ok).toBe(true);
  response = await fetch(base_url + '/test_db', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  expect(response.ok).toBe(true);
  response = await fetch(base_url + '/test_db', {
    method: 'DELETE',
  });
  expect(response.ok).toBe(true);
});

test('run initialization', async () => {
  expect(projects_dbs).toStrictEqual({});
  expect(people_dbs).toStrictEqual({});
  expect(metadata_dbs).toStrictEqual({});
  expect(data_dbs).toStrictEqual({});
  await initialize();
  expect(projects_dbs).not.toStrictEqual({});
  expect(people_dbs).not.toStrictEqual({});
  console.error(metadata_dbs);
  expect(metadata_dbs).not.toStrictEqual({});
  //expect(data_dbs).not.toStrictEqual({});
});
