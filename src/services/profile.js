import lo from 'lodash';
import { BOT_ID } from './bot';
import { getSession } from './session';

const PROP_ICONS_MAP = new Map([
  ['atk', '⚔'],
  ['def', '🛡'],
  ['hp', '❤'],
  ['mana', '💧'],
  ['gold', '💰'],
  ['pouches', '👝'],
  ['exp', '🔥'],
  ['stamina', '🔋'],
  ['event_pretended', '🤭'],
  ['event_streak', '🔪'],
]);

export async function getProfile(userId) {
  return getSession(BOT_ID, userId)
    .then(res => res.profile);
}

export function propIcon(prop) {
  return PROP_ICONS_MAP.get(prop);
}

export function formatProfile(profile, userId) {

  const { userName, guild_tag: tag } = profile;
  const { class: cls, castle } = profile;

  const { mana, gold, pouches } = profile;
  const { stamina, exp, hp } = profile;
  const { atk, def, lvl } = profile;

  const nameTag = tag ? `[${tag}] ` : '';

  const withUserId = userId ? `_${userId}` : '';

  // debug('formatProfile', userName);

  const res = [
    `<code>${lvl}</code> ${cls}${castle} <b>${nameTag || ''}${userName}</b>`,
    '',
    `⚔${atk} 🛡${def} ❤️${hp}${mana ? `💧${mana}` : ''}`,
    `💰${gold || 0} 👝${pouches || 0} 🔥${expView(exp)} 🔋${stamina}`,
    '',
    `/gear${withUserId} /stock${withUserId}`,
  ];

  return res.join('\n');

}

const BILLIONS = 1000000.0;
const THOUSANDS = 1000.0;

export function expView(exp) {
  return exp > BILLIONS ? `${lo.round(exp / THOUSANDS, 0)}K` : (exp || 0);
}
