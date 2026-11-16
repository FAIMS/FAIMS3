// SPDX-License-Identifier: Apache-2.0
import {LIST_LIMIT_MAX} from '@faims3/data-model';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const {getMock} = vi.hoisted(() => ({getMock: vi.fn()}));

// The real client pulls in the redux store; only `get` is needed here.
vi.mock('./client', () => ({default: {get: getMock}}));

import {listAllUsers, listUsers} from './users';

const user = (id: string) => ({_id: id, name: id, emails: []});

beforeEach(() => {
  getMock.mockReset();
});

describe('listUsers', () => {
  it('requests the default page when no paging is given', async () => {
    getMock.mockResolvedValue({users: [user('a')]});
    await expect(listUsers('server', 'admin')).resolves.toEqual({
      users: [user('a')],
    });
    expect(getMock).toHaveBeenCalledWith('server', 'admin', '/api/users');
  });

  it('sends limit and the startKey cursor', async () => {
    getMock.mockResolvedValue({users: []});
    await listUsers('server', 'admin', {limit: 20, startKey: '["a b","id"]'});
    expect(getMock).toHaveBeenCalledWith(
      'server',
      'admin',
      '/api/users?limit=20&startKey=%5B%22a+b%22%2C%22id%22%5D'
    );
  });
});

describe('listAllUsers', () => {
  it('follows nextStartKey until it is absent and keeps server order', async () => {
    getMock
      .mockResolvedValueOnce({users: [user('a'), user('b')], nextStartKey: 'b'})
      // A page may be empty and still have a cursor.
      .mockResolvedValueOnce({users: [], nextStartKey: 'c'})
      .mockResolvedValueOnce({users: [user('d')]});

    const users = await listAllUsers('server', 'admin');

    expect(users.map(u => u._id)).toEqual(['a', 'b', 'd']);
    expect(getMock.mock.calls.map(call => call[2])).toEqual([
      `/api/users?limit=${LIST_LIMIT_MAX}`,
      `/api/users?limit=${LIST_LIMIT_MAX}&startKey=b`,
      `/api/users?limit=${LIST_LIMIT_MAX}&startKey=c`,
    ]);
  });

  it('makes one request when the first page is the whole list', async () => {
    getMock.mockResolvedValue({users: [user('a')]});
    await expect(listAllUsers('server', 'admin')).resolves.toHaveLength(1);
    expect(getMock).toHaveBeenCalledTimes(1);
  });
});
