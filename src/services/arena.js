import find from 'lodash/find';

import Duel from '../models/Duel';
// import log from '../services/log';
//
// const { debug, error } = log('mw:arena');

export async function lastKnownUserID(name) {

  const lastDuel = await Duel.findOne({
    'players.name': name,
  }).sort('-ts');

  if (lastDuel) {
    return null;
  }

  const player = find(lastDuel.players, { name });

  return player && player.id;

}
