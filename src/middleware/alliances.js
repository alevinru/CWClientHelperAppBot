import lo from 'lodash';
import { eachSeriesAsync, mapSeriesAsync } from 'sistemium-telegram/services/async';
import chunk from 'lodash/chunk';
import log from '../services/log';
import * as usr from '../services/users';
import * as b from '../services/battles';
import * as a from '../services/aliancing';
import { fromCWFilter } from '../config/filters';

import Alliance from '../models/Alliance';
import AllianceLocation from '../models/AllianceLocation';

import Chat, * as c from '../models/Chat';
import globalSetting from '../services/globalSetting';
import { isChatAdmin } from '../services/util';

const { debug } = log('mw:alliances');

export function authAlliances(ctx) {
  const { profile } = ctx.session;
  if (!profile) {
    return false;
  }
  const { tags = [], admins = [] } = globalSetting.getValue('alliances') || {};
  ctx.state.allianceAdmins = admins;
  // debug('authAlliances', tags, profile.guild_tag);
  return tags.indexOf(profile.guild_tag) >= 0;
}

export function tasksFilter(ctx) {

  const { message } = ctx;
  const { text } = message;

  if (!text) {
    return false;
  }

  return lo.startsWith(text, '/allianceTasks')
    && authAlliances(ctx);

}

const FOUND_LOCATION_START = 'You found hidden location';
const FOUND_LOCATION = `${FOUND_LOCATION_START} (.+) lvl\\.(\\d+) .+: ([^ ]+)$`;
const FOUND_LOCATION_RE = new RegExp(FOUND_LOCATION);

const FOUND_HEADQUARTER_START = 'You found hidden headquarter';
const FOUND_HEADQUARTER = `${FOUND_HEADQUARTER_START} (.+)\\n.* ([^ ]+)$`;
const FOUND_HEADQUARTER_RE = new RegExp(FOUND_HEADQUARTER);

export function foundObjectiveFilter(ctx) {
  const { text } = ctx.message;
  return text
    && fromCWFilter(ctx)
    && lo.startsWith(text, FOUND_LOCATION_START);
}

export function foundHeadquarterFilter(ctx) {
  const { text } = ctx.message;
  return text
    && fromCWFilter(ctx)
    && lo.startsWith(text, FOUND_HEADQUARTER_START);
}

async function enabledAllianceInfo(ctx) {
  return Chat.findValue(ctx.chat.id, c.CHAT_SETTING_ALLIANCE_INFO);
}

export async function parseFoundLocation(ctx) {

  const { text } = ctx.message;

  const joined = text.replace(/\n/g, ' ');
  const [, name, lvl, code] = joined.match(FOUND_LOCATION_RE) || [];

  debug('parseFoundLocation', name, lvl, code);

  if (!name || !lvl || !code) {
    return;
  }

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const level = parseInt(lvl, 0);

  const doc = { name, level };

  const op = await AllianceLocation.updateOne({ code }, doc, { upsert: true });

  const { upserted, nModified } = op;

  const header = [];

  if (upserted) {
    header.push('🆕 location');
  } else if (nModified) {
    header.push('Updated location');
  } else {
    header.push('Existing location');
  }

  const fullName = `${name} lvl.${lvl}`;

  header.push(`<b>${fullName}</b>`);
  header.push(`<code>${code}</code>`);

  const reply = [header.join(' ')];

  const owner = await a.locationOwner(fullName);

  if (owner) {
    reply.push(`🚩 <b>${owner.name}</b> since ${b.dateFormat(owner.date)}`);
  }

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function parseFoundHeadquarter(ctx) {

  const { text } = ctx.message;

  const [, name, code] = text.match(FOUND_HEADQUARTER_RE) || [];

  debug('parseFoundHeadquarter', name, code);

  if (!name || !code) {
    return;
  }

  if (!await enabledAllianceInfo(ctx)) {
    return;
  }

  const reply = [];

  const op = await Alliance.updateOne({ code }, { name }, { upsert: true });

  const { upserted, nModified } = op;

  if (upserted) {
    reply.push('🆕 headquarter');
  } else if (nModified) {
    reply.push('Updated headquarter');
  } else {
    reply.push('Existing headquarter');
  }

  await ctx.replyWithHTML([
    ...reply,
    `<b>${name}</b>`,
    `<code>${code}</code>`,
  ].join(' '));

}

export async function parseTasks(ctx) {

  const { reply_to_message: replyTo } = ctx.message;
  const tasksText = replyTo.text;
  const [, title] = ctx.match;
  const alliances = await Alliance.find();
  const locations = await AllianceLocation.find();

  const targetsMap = new Map([
    ...alliances.map(i => [i.name, i.code]),
    ...locations.map(l => [l.fullName, l.code]),
  ]);

  const tasks = a.parseAllianceTask(tasksText);
  const byTag = a.allianceTasksByTag(tasks);
  const res = byTag.map(t => a.allianceTagTasksView(t, targetsMap, title));

  debug('parseTasks', alliances.length, tasks.length, byTag.length, res.length);

  await eachSeriesAsync(res, async tagView => {
    await ctx.replyWithHTML(tagView.join('\n\n'));
  });

}

export async function showLastAllianceBattle(ctx) {
  await showAllianceBattle(ctx, b.battleDate(new Date()));
}

export async function showLocations(ctx) {

  const [, filter] = ctx.match;

  const locations = await AllianceLocation.find({ expired: { $eq: null } })
    .sort({ name: 1 });

  const lastBattleTime = b.battleDate(new Date()).getTime();

  // const sortedLocations = lo.orderBy(locations, ['locationBonus', 'name']);

  const byType = lo.groupBy(locations, 'locationBonus');

  let types = lo.map(byType, (typeResults, locationBonus) => ({
    sortedLocations: lo.orderBy(typeResults, 'name'),
    locationBonus,
  }));

  if (filter) {
    types = lo.filter(types, ({ locationBonus }) => locationBonus === filter);
  }

  const reply = [
    lo.filter(['🏛 <b>Alliance', filter, 'locations</b>']).join(' '),
  ];

  await eachSeriesAsync(types, async ({ locationBonus, sortedLocations }) => {
    const list = await mapSeriesAsync(sortedLocations, async al => {
      const item = await locationListItem(al, lastBattleTime);
      return item;
    });
    if (!filter) {
      reply.push('', `<b>${lo.upperFirst(locationBonus)}</b>`);
    }
    reply.push('', ...list);
  });


  await ctx.replyWithHTML(reply.join('\n'));

}

async function locationListItem(location, lastBattleTime) {

  const { fullName, code } = location;
  const ownerInfo = await a.locationOwner(fullName);
  const [lastBattle] = await a.locationBattles(fullName).limit(1);

  const header = [
    a.atkLink(fullName, code),
    // fullName,
  ];

  if (lastBattle) {
    if (lastBattle.date.getTime() !== lastBattleTime) {
      header.push(a.atkLink('⚠️', code, '/ga_expire_'));
    }
  }

  const res = [header.join(' ')];

  if (ownerInfo) {
    const { name, date } = ownerInfo;
    res.push(` ╰${b.dateFormat(date)} 🚩 ${a.atkLink(name, name, '/af ')}`);
  }

  return res.join('\n');

}

export async function showAlliances(ctx) {

  const alliances = await Alliance.find()
    .sort({ name: 1 });

  const reply = [
    '<b>Alliances</b>',
    '',
    ...alliances.map(al => {
      // return `<code>${al.code}</code> ${al.name}`;
      return `/af_${al.code} ${al.name}`;
    }),
  ];

  await ctx.replyWithHTML(reply.join('\n'));

}

export async function showAllianceByTag(ctx) {

  const [, tag] = ctx.match;

  debug('showAllianceByTag', tag);

  const name = await a.allianceNameByTag(tag);

  if (!name) {
    await ctx.replyWithHTML(`Not found alliance with tag <b>${tag}</b>`);
    return;
  }

  ctx.state.allianceName = name;

  await showAllianceByName(ctx);

}

export async function showAllianceByName(ctx) {

  const name = ctx.state.allianceName || ctx.match[1];
  const $regex = new RegExp(lo.escapeRegExp(name), 'i');
  const alliance = await Alliance.findOne({ name: { $regex } });

  if (!alliance) {
    await ctx.replyWithHTML(`Not found alliance with name <b>${name}</b>`);
    return;
  }

  await showAlliance(ctx, alliance);

}

export async function showAllianceLocationByName(ctx) {

  const [, name, level] = ctx.match;
  const allianceLocation = await AllianceLocation.findOne({ name, level });

  if (!allianceLocation) {
    await ctx.replyWithHTML(`Not found location <b>${name} lvl.${level}</b>`);
    return;
  }

  await showAllianceLocation(ctx, allianceLocation);

}

export async function showAllianceLocation(ctx, allianceLocation) {

  await ctx.replyWithChatAction('typing');
  const battles = await a.locationBattles(allianceLocation.fullName);
  const reply = allianceLocationView(allianceLocation, battles);
  await ctx.replyWithHTML(reply.join('\n'));

}


function allianceLocationView(allianceLocation, battles = []) {

  const { name, code, level } = allianceLocation.toObject();

  const res = [
    [
      `<b>${name} lvl.${level}</b>`,
      `${a.atkLink('⚔️', code)}`,
      `${a.defLink('🛡️', code)}`,
    ].join(' '),
    `🆔 <code>${code}</code>`,
    // `🏷 ${tags.length ? tags.join(', ') : 'no information'}`,
  ];

  if (battles.length) {
    res.push('', ...battles.map(l => {
      const { results: [results] } = l;
      const line = [
        b.dateFormat(l.date),
        b.difficultyStatus(results),
      ];
      // if (results.defLeaders) {
      //   line.push(`x ${results.defLeaders.length}`);
      // }
      if (results.belongsTo) {
        line.push(`🚩 ${results.belongsTo}`);
      }
      return line.join(' ');
    }));
  }

  return res;

}

function isAdmin(ctx) {
  const { state: { allianceAdmins }, from: { id } } = ctx;
  return allianceAdmins.indexOf(id) >= 0;
}

export async function expireLocation(ctx) {

  if (!isAdmin(ctx)) {
    await ctx.replyWithHTML(`🚫 Expiring is not permitted for <code>${ctx.from.id}</code>`);
    return;
  }

  const [, code] = ctx.match;

  if (!code) {
    return;
  }

  const item = await AllianceLocation.findOne({ code })
    || await Alliance.findOne(({ code }));

  if (!item) {
    await ctx.replyWithHTML(`Not found alliance or location with code <code>${code}</code>`);
    return;
  }

  item.expired = true;
  item.ts = new Date();

  await item.save();

  await ctx.replyWithHTML(`✅ Set expired ${item.fullName || item.name} <code>${code}</code>`);

}


export async function showAllianceByCode(ctx) {

  const [, code] = ctx.match;
  const alliance = await Alliance.findOne({ code });

  if (!alliance) {
    const location = await AllianceLocation.findOne({ code });
    if (location) {
      await showAllianceLocation(ctx, location);
      return;
    }
    await ctx.replyWithHTML(`Not found alliance with code <code>${code}</code>`);
    return;
  }

  await showAlliance(ctx, alliance);

}

async function showAlliance(ctx, alliance) {
  const view = allianceView({
    ...alliance.toObject(),
    locations: await a.locationsOfAlliance(alliance),
    tags: await a.allianceTags(alliance),
  });
  await ctx.replyWithHTML(view.join('\n'));
}


function allianceView(alliance) {

  const {
    tags = [],
    name,
    code,
    locations,
  } = alliance;

  const res = [
    `<b>${name}</b> ${a.atkLink('⚔️', code)}`,
    '',
    `🆔 <code>${code}</code>`,
    `🏷 ${tags.length ? tags.join(', ') : 'no information'}`,
  ];

  if (locations.length) {
    res.push('', ...locations.map(l => lo.filter([
      b.dateFormat(l.date),
      `🚩 ${l.name}`,
      l.seemsExpired && '⚠️',
    ]).join(' ')));
  }

  return res;

}

export async function showAllianceBattleByCode(ctx) {

  const [, dateP, hourP] = ctx.match;
  const [, year, month, day] = dateP.match(/(\d\d)(\d\d)(\d\d)/);

  const date = new Date(`20${year}-${month}-${day} ${hourP}:00:00.000Z`);

  debug('show', dateP, hourP, date);

  await showAllianceBattle(ctx, date);

}

async function showAllianceBattle(ctx, date) {

  const reply = await a.allianceBattleFullView(date);

  b.battleNavs(date, reply, 'ab');

  await ctx.replyWithHTML(reply.join('\n'), { disable_web_page_preview: true });

}


export async function notifyForTask(ctx) {

  const { reply_to_message: { text } = {} } = ctx.message;

  if (!text) {
    return;
  }

  const lines = lo.filter(text.split('\n'));

  const namesMap = lines.map(line => {
    const [, namesText] = line.match(/👉(.+)$/) || [];
    return namesText && namesText.split(', ');
  });

  const names = lo.filter(lo.flatten(namesMap).map(lo.trim));

  if (!names.length) {
    return;
  }

  if (!await isChatAdmin(ctx)) {
    return;
  }

  const users = await usr.usersFromCWNames(names);

  await eachSeriesAsync(chunk(users.map(u => `@${u.username}`), 3), async replyChunk => {
    await ctx.replyWithHTML(replyChunk.join(' '));
    await new Promise(resolve => setTimeout(resolve, 500));
  });

}

export async function castlesPlayers(ctx) {

  const allCastlesPlayers = [];
  const { id: chatId } = ctx.chat;
  const waiting = '⏳ calculating castles info';

  const { message_id: messageId } = await ctx.replyWithHTML(waiting);

  await eachSeriesAsync(b.CASTLE_CODES, async code => {

    const castle = b.castleByCode(code);
    await ctx.replyWithChatAction('typing');

    const players = await a.castlePlayers(castle);
    const byLeague = lo.groupBy(players, a.playerLeague);

    allCastlesPlayers.push({
      castle,
      code,
      byLeague,
      total: players.length,
    });

    await showResults();

  });

  async function showResults() {
    const results = allCastlesPlayers.map(({ castle, byLeague, total }) => {
      return pivotLeagues(castle, byLeague, total);
    });

    const header = a.LEAGUES.map(league => `${league}`);

    const reply = [
      inProgress() ? waiting : '<b>Active arena players</b>',
      '',
      `<code>   ${header.join(' ')}</code>`,
      ...lo.orderBy(results, ['total'], ['desc'])
        .map(({ line }) => line),
    ];

    await ctx.telegram
      .editMessageText(chatId, messageId, null, reply.join('\n'), { parse_mode: 'HTML' });

  }

  function inProgress() {
    return b.CASTLE_CODES.length > allCastlesPlayers.length;
  }

}

export async function castlePlayersInfo(ctx) {

  const [, code] = ctx.match;

  const castle = b.castleByCode(code);

  if (!castle) {
    await ctx.replyWithHTML(`⚠️ Invalid castle code ${code}`);
    return;
  }

  await ctx.replyWithChatAction('typing');
  const players = await a.castlePlayers(castle);
  await playersInfo(ctx, players, `${castle} arena players`);

}

async function playersInfo(ctx, players, title) {

  const byTag = lo.groupBy(players, ({ tag }) => tag || '-');
  const byLeague = lo.map(byTag, (tagPlayers, tag) => ({
    tag,
    tagByLeague: lo.groupBy(tagPlayers, a.playerLeague),
    total: tagPlayers.length,
  }));

  const playersLeagues = lo.map(byLeague, ({ tagByLeague }) => {
    const res = lo.map(tagByLeague, (p, league) => league);
    return lo.uniq(res);
  });

  const leagues = lo.orderBy(lo.uniq(lo.flatten(playersLeagues)));

  const results = byLeague.map(({ tag, tagByLeague, total }) => {
    const name = lo.padEnd(`${tag}`, 3, ' ');
    return pivotLeagues(`<code>${name}</code>`, tagByLeague, total, leagues);
  });

  const header = leagues.map(league => `${league}`);

  const totals = leagues.map(league => {
    return lo.sumBy(byLeague, ({ tagByLeague }) => {
      return lo.get(tagByLeague[league], 'length') || 0;
    });
  });

  const footer = lo.map(totals, t => lo.padStart(t.toString(), 3, ' '));

  const lines = lo.orderBy(results, ['total'], ['desc'])
    .map(({ line }) => line);

  const chunks = lo.chunk(lines, 20);

  const reply0 = [
    title,
    '',
    `<code>   ${header.join(' ')}</code>`,
    ...chunks[0],
  ];

  const replies = lo.filter([
    reply0,
    ...lo.takeRight(chunks, chunks.length - 1),
  ], 'length');

  if (lines.length > 1) {
    lo.last(replies).push(`<code>∑   ${footer.join(' | ')}</code>`);
  }

  await eachSeriesAsync(replies, async reply => {
    debug(reply);
    await ctx.replyWithHTML(reply.join('\n'));
  });

}

function pivotLeagues(rowName, byLeague, total, leagues = a.LEAGUES) {

  const values = leagues.map(league => {
    const count = lo.get(byLeague[league], 'length');
    return lo.padStart(count, 3, ' ');
  }).join(' | ');

  return {
    total,
    line: [
      rowName,
      `<code> ${values} | </code>`,
      `<b>${total}</b>`,
    ].join(''),
  };
}

export async function tagsPlayersInfo(ctx) {

  const [, tagsList] = ctx.match;

  const tags = lo.split(tagsList, /[, ]+/)
    .map(lo.trim)
    .map(lo.toUpper);

  await ctx.replyWithChatAction('typing');

  const players = await a.tagsPlayers(tags);

  if (!players.length) {
    await ctx.replyWithHTML(`No arena activity data for <b>${tags.join(' ')}</b>`);
    return;
  }

  const title = [
    '<b>Guild league info</b>',
    // `<code>${tags.join(' ')}</code>`,
  ];

  await playersInfo(ctx, players, title.join('\n'));

}

export async function alliancePin(ctx) {

  const [, targetsText] = ctx.match;

  const targets = a.targetsFromText(targetsText);

  if (!targets) {
    await ctx.replyWithHTML('⚠️ can\'t parse targets');
    return;
  }

  const tasks = await a.findByTasks(targets);

  const res = [
    b.battleIcon(b.nextDate(b.battleDate(new Date()))),
    '',
    ...tasks.map(taskListItem),
  ];

  await ctx.replyWithHTML(res.join('\n'));

}

function taskListItem(task) {

  const { fullName, league, code } = task;

  debug(fullName, code.length);

  return lo.filter([
    league && `<code>${league}</code>`,
    task.type === 'a' ? '⚔' : '🛡',
    task.type === 'a' ? a.atkLink(fullName, code) : a.defLink(fullName, code),
  ]).join(' ');

}
