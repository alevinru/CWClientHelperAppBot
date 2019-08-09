import fpMap from 'lodash/fp/map';
import filter from 'lodash/filter';
import mapValues from 'lodash/mapValues';

import User from '../models/User';

import { hgetallAsync, hgetAsync } from './redis';
import log from './log';

const { debug } = log('users');

export const USERS_HASH = 'users';

export async function getAuthorizedUsers({ profile }) {

  if (!profile) {
    return [];
  }

  const { guild_tag: tag } = profile;

  return User.find({ 'profile.guild_tag': tag }).sort({ 'profile.userName': 1, id: 1 });

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

  if (userId === toUserId) {
    return true;
  }

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


export async function settingValue(userId, key) {

  const user = await User.findOne({ id: userId });

  if (!user) {
    throw new Error(`Unknown user <code>${userId}</code>`);
  }

  const setting = allSettings()[key];

  if (!setting) {
    throw new Error(`Unknown setting <code>${key}</code>`);
  }

  return settingValueWithDefault(setting, user.settings[key]);

}

function settingValueWithDefault(setting, value) {
  return value === undefined ? setting.defaults : value;
}

export function applyDefaults(settings) {
  return mapValues(allSettings(), (setting, key) => {
    return settingValueWithDefault(setting, settings[key]);
  });
}

export const NOTIFY_ORDER_FAIL = 'notifyOrderFail';
export const NOTIFY_SALES = 'notifySales';

export function allSettings() {
  return {
    [NOTIFY_ORDER_FAIL]: {
      type: Boolean,
      defaults: true,
    },
    [NOTIFY_SALES]: {
      type: Boolean,
      defaults: false,
    },
  };
}
