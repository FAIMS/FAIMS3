import {
  DIRECTORY_PROTOCOL,
  DIRECTORY_HOST,
  DIRECTORY_PORT,
} from '../buildconfig';

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
