import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
} from '../buildconfig';

const COUCHDB_USER = String(process.env.COUCHDB_USER);
const COUCHDB_PASSWORD = String(process.env.COUCHDB_PASSWORD);

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
    encodeURIComponent(COUCHDB_USER) +
    ':' +
    encodeURIComponent(COUCHDB_PASSWORD) +
    '@' +
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
