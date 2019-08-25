import lo from 'lodash';
import Markup from 'telegraf/markup';
import secondsDiff from 'date-fns/difference_in_seconds';
import Chat from '../models/Chat';
// import log from './log';
import { modifiersMap } from '../models/MobHunt';

// const { debug } = log('mobs');

const MOBS_HEADERS = [
  'You met some hostile creatures. Be careful:',
  'Ты заметил враждебных существ. Будь осторожен:',
];

const MOBS_RE = RegExp(`(${MOBS_HEADERS.join('|')})\\n`);
const MOBS_MODIFIERS = /[ ][ ]╰ (.+)/;

const HELPER_LEVEL_RANGE = 7;

const MOB_TYPE_ICONS = new Map([
  ['bear', '🐻'],
  ['wolf', '🐺'],
  ['boar', '🐗'],
]);

const FORWARD_LIFETIME = 18000;

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

function mobView(mob) {
  const { level = 0, modifiers, name } = mob;
  const icons = lo.filter(lo.map(modifiers, modifier => modifiersMap.get(modifier)));
  return lo.filter([
    `<code>${level}</code>`,
    name,
    icons.length && icons.join(''),
  ]).join(' ');
}

function mobType({ name }) {
  const [, type] = name.match(/.* (bear|wolf|boar)/i) || [];
  return lo.lowerCase(type);
}

function mobsIcons(mobs) {
  const types = lo.groupBy(mobs, mobType);
  return lo.filter(Object.keys(types).map(type => MOB_TYPE_ICONS.get(type)));
}

export function mobOfferView({
  mobs, command, date, helper,
}) {

  const secondsLeft = secondsToFight(date);

  const reply = [
    [
      mobsIcons(mobs).join(' ') || '👾',
      secondsLeft > 0 ? 'fight in' : 'fight is',
      `<b>${timeLeftView(secondsLeft)}</b>`,
    ].join(' '),
    '',
    ...lo.map(mobs, mobView),
  ];

  if (helper) {
    reply.push('', helperView(helper));
  }

  const { level } = lo.maxBy(mobs, 'level') || {};

  const go = level ? `⚔ ${level - HELPER_LEVEL_RANGE} - ${level + HELPER_LEVEL_RANGE}` : '⚔';

  const buttons = [];

  if (secondsLeft > 0) {
    buttons.push(Markup.urlButton(go, `http://t.me/share/url?url=${command}`));
  }

  if (!helper) {
    buttons.push(Markup.callbackButton('I am helping!', 'mob_helping'));
  }

  const keyboard = Markup.inlineKeyboard(buttons).extra();

  return { text: reply.join('\n'), keyboard };

  function helperView({ userName, firstName, lastName }) {
    return [
      `<a href="https://t.me/${userName}">${firstName} ${lastName}</a>`,
      secondsLeft > 1 ? 'is helping' : 'was helping',
    ].join(' ');
  }

}

export async function chatMobHunting(chatId) {
  return Chat.findValue(chatId, 'mobHunting');
}

export function secondsToFight(date) {
  return FORWARD_LIFETIME - secondsDiff(new Date(), date);
}

function timeLeftView(seconds) {
  if (seconds < 1) {
    return 'expired';
  }
  const minutes = Math.floor(seconds / 60.0);
  const second = seconds - minutes * 60;
  return `${lo.padStart(minutes, 2, '0')}:${lo.padStart(second, 2, '0')}`;
}
