import map from 'lodash/map';
import filter from 'lodash/filter';

import { hgetallAsync } from './redis';

export const USERS_HASH = 'users';

export async function getUsers(session) {

  const { teamId } = session;

  const users = await hgetallAsync(USERS_HASH)
    .then(res => map(res, JSON.parse));

  return filter(users, user => user.teamId === teamId);

}
