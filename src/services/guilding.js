import lo from 'lodash';

import log from './log';

const { debug } = log('mw:guilding');

debug('guilding');

export const STATES = {
  SNOOZE: 'snooze',
  ATTACK: 'attack',
  DEFEND: 'defend',
  ARENA: 'arena',
  LOOKUP: 'lookup',
  FORAY: 'foray',
  REST: 'rest',
  WORK: 'work',
  VALLEY: 'valley',
  FOREST: 'forest',
  SWAMP: 'swamp',
};

const ROSTER_LINE_RE = /^#(\d+) ([^\d]+)(\d+) \[(.+)] (.+)$/;

const STATE_ICON_NAME_MAP = new Map([
  ['💤', STATES.SNOOZE],
  ['🛌', STATES.REST],
  ['⚒', STATES.WORK],
  ['📯', STATES.ARENA],
  ['⛰', STATES.VALLEY],
  ['🔎', STATES.LOOKUP],
  ['🌲', STATES.FOREST],
  ['🍄', STATES.SWAMP],
  ['🛡', STATES.DEFEND],
  ['⚔', STATES.ATTACK],
]);

export function parseRoster(text) {

  const lines = text.split('\n');

  if (!lines && lines.length) {
    return [];
  }

  const [, guildName] = lines[0].match(/[^0-9a-zа-я]+(.+)$/i);

  const playersMatch = lines.map(line => line.match(ROSTER_LINE_RE));

  return {
    guildName,
    players: lo.filter(playersMatch).map(([, , cls, lvl, stateIcon, name]) => ({
      cls,
      lvl,
      stateIcon,
      state: STATE_ICON_NAME_MAP.get(stateIcon) || 'unknown',
      name,
    })),
  };

}
