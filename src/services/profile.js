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
]);

export async function getProfile(userId) {
  return getSession(BOT_ID, userId)
    .then(res => res.profile);
}

export function propIcon(prop) {
  return PROP_ICONS_MAP.get(prop);
}
