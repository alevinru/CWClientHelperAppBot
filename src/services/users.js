import fmap from 'lodash/fp/map';
import filter from 'lodash/filter';

import { hgetallAsync, hgetAsync } from './redis';

export const USERS_HASH = 'users';

export async function getAuthorizedUsers(session) {

  const { teamId } = session;

  const users = await hgetallAsync(USERS_HASH)
    .then(fmap(JSON.parse));

  return filter(users, user => user.teamId === teamId);

}

export async function getUsers(predicate) {

  const users = await hgetallAsync(USERS_HASH)
    .then(fmap(JSON.parse));

  return filter ? filter(users, predicate) : users;

}

export async function getUser(userId) {

  return hgetAsync(USERS_HASH, userId)
    .then(JSON.parse);

}
