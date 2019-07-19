import find from 'lodash/find';

import Duel from '../models/Duel';
import log from './log';

const { debug } = log('mw:arena');

export async function lastKnownUserID(name) {

  const lastDuel = await Duel.findOne({
    'players.name': name,
  }).sort('-id');

  if (!lastDuel) {
    return null;
  }

  const player = find(lastDuel.players, { name });

  debug('lastKnownUserID:', name, lastDuel, player);

  return player && player.id;

}
