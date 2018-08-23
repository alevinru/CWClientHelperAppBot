import map from 'lodash/map';

import * as redis from './redis';
import { getProfile } from './profile';

const debug = require('debug')('laa:cwb:trading');

const TRADERS_PREFIX = 'traders';

// function getId() {
//   return redis.getId(TRADERS_PREFIX);
// }

export async function getTraders() {

  const traders = await redis.hgetallAsync(TRADERS_PREFIX);

  debug('traders', traders);

  return map(traders, data => JSON.parse(data));

}

export async function grantTrading(userId) {

  const profile = await getProfile(userId);

  const trader = {
    id: userId,
    profile,
  };

  await redis.hsetAsync(TRADERS_PREFIX, userId, JSON.stringify(trader));

  return trader;
}
