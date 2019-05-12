import fpMap from 'lodash/fp/map';
import filter from 'lodash/filter';
import User from '../models/User';

import { hgetallAsync, hgetAsync } from './redis';
import log from './log';

const { debug } = log('users');

export const USERS_HASH = 'users';

export async function getAuthorizedUsers(session) {

  const { teamId } = session;

  const users = await hgetallAsync(USERS_HASH)
    .then(fpMap(JSON.parse));

  return filter(users, user => user.teamId === teamId);

}

export async function getUsers(predicate) {

  const users = await hgetallAsync(USERS_HASH)
    .then(fpMap(JSON.parse));

  return filter ? filter(users, predicate) : users;

}

export async function getUser(userId) {

  return hgetAsync(USERS_HASH, userId)
    .then(JSON.parse);

}

export async function saveUser(from, profile) {

  const { id, username } = from;
  const { first_name: firstName, last_name: lastName } = from;

  const $set = {
    firstName,
    lastName,
    username,
    $currentDate: { ts: true },
  };

  if (profile) {
    $set.profile = profile;
  }

  return User.updateOne({ id }, { $set }, { upsert: true });

}

export async function isTrusted(userId, toUserId) {
  const result = await User.findOne({
    id: userId,
    [`trusts.${toUserId}`]: true,
  });
  debug('isTrusted', result);
  return !!result;
}

export async function saveTrust(id, toUserId, value = true) {

  const $set = {
    [`trusts.${toUserId}`]: value,
    $currentDate: { ts: true },
  };

  return User.updateOne({ id }, { $set });

}
