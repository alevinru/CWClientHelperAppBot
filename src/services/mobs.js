import lo from 'lodash';
import Markup from 'telegraf/markup';
import Chat from '../models/Chat';
import log from './log';

const { debug } = log('mobs');

const MOBS_HEADERS = [
  'You met some hostile creatures. Be careful:',
  'Ты заметил враждебных существ. Будь осторожен:',
];

const MOBS_RE = RegExp(`(${MOBS_HEADERS.join('|')})\\n`);
const MOBS_MODIFIERS = /[ ][ ]╰ (.+)/;


export function mobsFromText(text) {

  const [, mobHeader] = text.match(MOBS_RE) || [];

  if (!mobHeader) {
    // debug('mobsFromText: no mobs');
    return false;
  }

  const mobsArray = text.replace(mobHeader, '').split('\n');

  const mobs = mobsArray.map((mobText, idx) => {

    const [, name, lvl] = mobText.match(/([a-z ]*) lvl\.(\d+)/i) || [];

    if (!name) {
      return false;
    }

    const mob = { name, level: parseInt(lvl, 0) };
    const nextLine = mobsArray[idx + 1];

    if (nextLine) {
      const [, modifiersText] = nextLine.match(MOBS_MODIFIERS) || [];
      const modifiers = modifiersText && lo.split(modifiersText, ', ');
      if (modifiers) {
        mob.modifiers = modifiers;
      }
    }

    return mob;

  });

  const [command] = text.match(/\/fight_[a-z0-9]+/i);

  return { mobs: lo.filter(mobs), command };

}

export function mobOfferView({ mobs, command }) {

  const reply = lo.map(mobs, mob => {
    return [
      `<code>${mob.level}</code> ${mob.name}`,
    ].join(' ');
  });

  const { level } = lo.maxBy(mobs, 'level');

  const go = `⚔ ${level - 5} - ${level + 5}`;

  const kb = Markup.inlineKeyboard([
    Markup.urlButton(go, `http://t.me/share/url?url=${command}`),
    Markup.callbackButton('I will help!', 'mob_helping'),
  ])
    .extra();

  debug(JSON.stringify(kb));

  return { text: reply.join('\n'), keyboard: kb };

}

export async function chatMobHunting(chatId) {
  return Chat.findValue(chatId, 'mobHunting');
}
