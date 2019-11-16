import lo from 'lodash';
import Markup from 'telegraf/markup';
import Chat from '../models/Chat';
// import log from './log';
import { modifiersMap, secondsToFight } from '../models/MobHunt';

// const { debug } = log('mobs');

const MOBS_HEADERS = [
  'You met some hostile creatures. Be careful:',
  'Ты заметил враждебных существ. Будь осторожен:',
];

const CHEATERS_CLUB_HEADER = [
  'Ты нашел место проведения подпольных боёв без правил',
  'You discovered a hidden underground brawl club',
];

const MAX_HELPERS = 5;

const MOBS_RE = RegExp(`(${MOBS_HEADERS.join('|')})\\n`);
const CHEATERS_RE = RegExp(`(${CHEATERS_CLUB_HEADER.join('|')})`);

const MOBS_MODIFIERS = /[ ][ ]╰ (.+)/;

const HELPER_LEVEL_RANGE = 10;

const MOB_TYPE_ICONS = new Map([
  ['bear', '🐻'],
  ['wolf', '🐺'],
  ['boar', '🐗'],
  ['champion', '⚜'],
]);

export function mobsFromText(text) {

  const isCheaters = text.match(CHEATERS_RE);

  const [, mobHeader] = text.match(MOBS_RE) || isCheaters || [];

  if (!mobHeader) {
    // debug('mobsFromText: no mobs');
    return false;
  }

  const mobsArray = text.replace(mobHeader, '').split('\n');

  const mobs = isCheaters ? [] : mobsArray.map((mobText, idx) => {

    const [, cntText, name, lvl] = mobText.match(/(\d* x )?([a-z ]*) lvl\.(\d+)/i) || [];

    if (!name) {
      return false;
    }

    const cnt = cntText ? cntText.match(/\d+/)[0] : '1';

    const mob = { name, level: parseInt(lvl, 0), cnt: parseInt(cnt, 0) };
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

  const isAmbush = /ambush/.test(text);

  const [command] = text.match(/\/fight_[a-z0-9]+/i);

  const [, levelString] = text.match(/lvl\.(\d+) /) || [];
  const level = (isCheaters && parseInt(levelString, 0)) || null;

  return {
    mobs: lo.filter(mobs),
    command,
    isAmbush,
    level,
    isCheaters: !!isCheaters,
  };

}

function numberView(num) {
  if (num <= 1) {
    return '';
  }
  return `x ${num}⃣`;
}

function mobView(mob) {
  const {
    level = 0, modifiers, name, cnt = 1,
  } = mob;
  const icons = lo.filter(lo.map(modifiers, modifier => modifiersMap.get(modifier)));
  return lo.filter([
    `<code>${level}</code>`,
    MOB_TYPE_ICONS.get(mobType(mob)),
    name,
    numberView(cnt),
    icons.length && icons.join(''),
  ]).join(' ');
}

function mobType({ name }) {
  const [, type] = name.match(/.* (bear|wolf|boar|champion)/i) || [];
  return lo.lowerCase(type);
}

function mobsIcons(mobs) {
  const types = lo.groupBy(mobs, mobType);
  return lo.filter(Object.keys(types).map(type => MOB_TYPE_ICONS.get(type)));
}

export function mobOfferView(mobHunt) {

  const { mobs, command, date } = mobHunt;
  const { helper, isAmbush, helpers = [] } = mobHunt;
  const { isCheaters, level, reporter } = mobHunt;

  const secondsLeft = secondsToFight(date, isAmbush);
  const notExpired = secondsLeft > 0;

  const headIcons = mobsIcons(mobs).join(' ') || (isCheaters ? '🎃' : '👾');
  const hasHelper = helper && helper.userId;

  const reply = [
    lo.filter([
      isAmbush && 'Ambush',
      headIcons,
      isCheaters && 'Cheaters',
      notExpired ? 'fight in' : 'fight is',
      `<b>${timeLeftView(secondsLeft)}</b>`,
    ]).join(' '),
  ];

  if (mobs.length) {
    reply.push('', ...lo.map(mobs, mobView));
  } else if (level) {
    reply.push('', mobView({ level, name: 'level Cheaters' }));
  }

  const helpersToAdd = [];

  if (reporter && !(helpers && helpers.length)) {
    helpersToAdd.push(helperView(reporter, 'encountered'));
  }

  if (hasHelper) {
    helpersToAdd.push(helperView(helper));
  } else if (helpers && helpers.length) {
    helpersToAdd.push(...lo.map(helpers, helperView));
  }

  reply.push('', ...helpersToAdd);

  const maxLevel = mobs.length ? Math.floor(lo.sumBy(mobs, 'level') / mobs.length) : level;

  const go = maxLevel ? `⚔ <= ${maxLevel + HELPER_LEVEL_RANGE}` : '⚔';

  const buttons = [];

  if (notExpired) {
    buttons.push(Markup.urlButton(go, `http://t.me/share/url?url=${command}`));
  }

  if (!hasHelper && helpers.length < maxHelpers(mobHunt)) {
    buttons.push(Markup.callbackButton(`I ${notExpired ? 'am' : 'was'} helping!`, 'mob_helping'));
  }

  const keyboard = Markup.inlineKeyboard(buttons).extra();

  return { text: reply.join('\n'), keyboard };

  function helperView(player, role) {

    const { userName, firstName, lastName } = player;
    const { hp } = player;
    const name = lo.filter([firstName, lastName]).join(' ') || 'Name unknown';

    const roleIcon = role === 'encountered' ? '🆘' : '🤝';

    return lo.filter([
      roleIcon,
      player.level && `<code>${player.level}</code>`,
      // isCheaters && streak >= 0 && `🔪${streak}`,
      `<a href="https://t.me/${userName}">${escapeName(name)}</a>`,
      // !(hp || role) && (notExpired ? 'is helping' : 'was helping'),
      // !notExpired && role,
      hp && `❤${hp}`,
    ]).join(' ');
  }

}

function maxHelpers({ isCheaters, isAmbush }) {
  if (isAmbush) {
    return MAX_HELPERS;
  }
  if (isCheaters) {
    return 3;
  }
  return 1;
}

const HTML_REPLACERS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
};

function escapeName(name) {
  return name
    .replace(/[&<>]/g, x => HTML_REPLACERS[x]);
}

export async function chatMobHunting(chatId) {
  return Chat.findValue(chatId, 'mobHunting');
}

function timeLeftView(seconds) {
  if (seconds < 1) {
    return 'over';
  }
  const minutes = Math.floor(seconds / 60.0);
  const second = seconds - minutes * 60;
  return `${lo.padStart(minutes, 2, '0')}:${lo.padStart(second, 2, '0')}`;
}
