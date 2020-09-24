import lo from 'lodash';
import { mapSeriesAsync } from 'sistemium-telegram/services/async';
import { addDays } from 'date-fns';
import * as b from './battles';

import Alliance from '../models/Alliance';
import AllianceLocation, * as al from '../models/AllianceLocation';
import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';
import Duel from '../models/Duel';

import log from './log';

const { debug } = log('alliancing');

debug('alliance-ing');

export async function locationsOfAlliance(alliance) {

  if (!alliance) {
    return null;
  }

  const $match = { 'results.belongsTo': alliance.name };

  const battles = await AllianceMapState.aggregate([
    { $match },
    { $sort: { date: 1 } },
    { $unwind: '$results' },
    { $match },
  ]);

  const namesArray = battles.map(({ date, results: { name } }) => ({ name, date }));

  const names = lo.keyBy(namesArray, 'name');
  const res = await mapSeriesAsync(lo.map(names), async location => {
    const { name: fullName } = location;
    const owner = await locationOwner(fullName);
    if (!owner || owner.name !== alliance.name) {
      return false;
    }
    const seemsExpired = await locationSeemsExpired(fullName);
    const [, name, level] = fullName.match(/([a-z0-9 ]+) lvl\.([0-9]{2})/i);
    const isExpired = await AllianceLocation.findOne({ name, level, expired: true });
    if (isExpired) {
      debug(isExpired.toObject());
    }
    if (seemsExpired && isExpired) {
      return false;
    }
    return { ...location, seemsExpired };
  });

  return lo.filter(res);

}

export async function locationSeemsExpired(fullName) {
  const lastBattleTime = b.battleDate(new Date()).getTime();
  const [lastBattle] = await locationBattles(fullName).limit(1);
  return lastBattle && lastBattle.date.getTime() !== lastBattleTime;
}

export async function locationOwners(allianceLocation) {

  if (!allianceLocation) {
    return null;
  }

  const $elemMatch = {
    belongsTo: { $ne: null },
    name: allianceLocation.fullName,
  };

  const $match = { results: { $elemMatch } };

  const battles = await AllianceMapState.aggregate([
    { $match },
    { $sort: { date: 1 } },
    { $unwind: '$results' },
    { $match: lo.mapKeys($elemMatch, (val, key) => `results.${key}`) },
  ])
    .sort({ date: -1 });

  const namesArray = battles.map(({ date, results: { belongsTo: name } }) => ({ name, date }));

  const names = lo.keyBy(namesArray, 'name');
  return lo.map(names);

}

export function locationBattles(fullName) {

  return AllianceMapState.find({
    'results.name': fullName,
  }, { 'results.$': 1, date: 1 }).sort({ date: -1 });

}

export async function locationOwner(name) {

  const battle = await AllianceMapState.findOne({
    results: { $elemMatch: { name, belongsTo: { $ne: null } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  if (!battle) {
    return null;
  }

  // debug(battle.results);

  return { date: battle.date, name: battle.results[0].belongsTo };

}

export async function allianceNameByTag(tag) {

  const $regex = new RegExp(`\\[${tag}]`, 'i');

  const battle = await AllianceBattle.findOne({
    results: { $elemMatch: { defLeaders: { $regex } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  return battle && battle.results[0].name;

}

export async function allianceTags(alliance) {

  if (!alliance) {
    return null;
  }

  const battles = await AllianceBattle.find({
    results: { $elemMatch: { name: alliance.name, defLeaders: { $ne: null } } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  const tagsArray = battles.map(({ date, results: [{ defLeaders }] }) => ({
    tags: defLeaders.map(tagFromLeader),
    date,
  }));

  const tags = lo.uniq(lo.flatMap(tagsArray, 'tags'));

  // debug(tags);

  return lo.orderBy(tags);

}

function tagFromLeader(leader) {
  const [, tag] = leader.match(/\[(.+)]/);
  return tag;
}

export function allianceBattleView(allianceBattle) {

  const { date, reportLink, results } = allianceBattle;

  const orderedResults = lo.orderBy(results, 'name');

  return [
    `${b.dateFormat(date)} <b>Alliances battle</b>`,
    '',
    `🤝 <a href="${b.reportLinkHref(reportLink)}">Headquarters report</a>`,
    '',
    ...lo.map(orderedResults, battleResultView),
  ];

}


export function allianceMapStateView(allianceMapState) {

  const { reportLink, results } = allianceMapState;

  const orderedResults = lo.orderBy(results, 'name');

  const withTypes = lo.map(orderedResults, l => {
    const locationType = al.locationType.call(l);
    return {
      ...l,
      locationType,
      locationBonus: al.locationBonus.call({ locationType }),
    };
  });

  const byType = lo.groupBy(withTypes, 'locationBonus');

  const res = lo.map(byType, (typeResults, locationBonus) => ({ typeResults, locationBonus }));

  return [
    `🗺 <a href="${b.reportLinkHref(reportLink)}">Map state report</a>`,
    '',
    res.map(({ typeResults, locationBonus }) => [
      `<b>${lo.upperFirst(locationBonus)}</b>`,
      // '',
      ...lo.map(typeResults, mapStateResultView),
    ].join('\n')).join('\n\n'),
  ];

}


function battleResultView(result) {

  const { stock, glory } = result;

  return lo.filter([
    b.difficultyStatus(result),
    result.name,
    stock && `<code>-${stock}</code>📦`,
    glory && `<code>-${glory}</code>🎖`,
  ]).join(' ');

}


function mapStateResultView(result) {

  const { belongsTo } = result;

  return lo.filter([
    b.difficultyStatus(result),
    result.name,
    belongsTo && `\n ╰ 🚩 ${belongsTo}`,
  ]).join(' ');

}

export function allianceTagTasksView({ tag, tasks }, targets = new Map(), title) {

  return [
    `${title || ''}<b>${tag}</b>`,
    tasks.map(({ target, type, names }) => {
      const alliance = targets.get(target);
      const atk = alliance ? `/ga_${type === '⚔️' ? 'atk' : 'def'}_${alliance}` : target;
      return [
        `<a href="http://t.me/share/url?url=${atk}">${type}${target}</a>`,
        '👉',
        names.join(', '),
      ].join(' ');
    }).join('\n\n'),
  ];

}

export function atkLink(name, code, cmd = '/ga_atk_') {
  return `<a href="http://t.me/share/url?url=${cmd}${code}">${name}</a>`;
}

export function defLink(name, code) {
  return atkLink(name, code, '/ga_def_');
}

const TASK_LINE_RE = /^(.{2,3})[ \t]{2,}(.+)[ \t]{2,}(🛡|⚔️)(.+ .+)$/;

export function parseAllianceTask(text) {

  const lines = text.split('\n');

  const tasks = lines.map(line => {
    const [, tag, name, type, target] = line.match(TASK_LINE_RE) || [];
    return tag && name && target && {
      tag, name, type, target,
    };
  });

  return lo.filter(tasks);

}

export function allianceTasksByTag(tasks) {

  const byTag = lo.groupBy(tasks, 'tag');

  const res = lo.map(byTag, (tagTasks, tag) => {
    const byTarget = lo.groupBy(tagTasks, 'target');
    const byTargetArray = lo.map(byTarget, (names, target) => ({
      target,
      type: names[0].type,
      names: lo.map(lo.orderBy(names, 'name'), ({ name }) => lo.trim(name)),
    }));
    return {
      tag,
      tasks: lo.orderBy(byTargetArray, 'target'),
    };
  });

  return lo.orderBy(res, 'tag');

}

export async function allianceBattleFullView(date) {

  const filters = { date };

  const battleMongo = await AllianceBattle.findOne(filters);

  const battle = battleMongo && battleMongo.toObject();

  const reply = [];

  if (!battle) {
    reply.push(`<code>Not found</code> ${b.dateFormat(date)} battle`);
  } else {
    reply.push(...allianceBattleView(battle));
  }

  const mapStateMongo = await AllianceMapState.findOne(filters);

  if (mapStateMongo) {
    reply.push('', ...allianceMapStateView(mapStateMongo.toObject()));
  }

  return reply;

}

export const LEAGUES = [
  '01-19',
  '20-39',
  '40-59',
  '60-79',
];

export function playerLeague({ level }) {

  if (level >= 60) {
    return '60-79';
  }

  if (level >= 40) {
    return '40-59';
  }

  if (level >= 20) {
    return '20-39';
  }

  if (level >= 1) {
    return '01-19';
  }

  return null;

}

export async function activePlayers(duelFilter, matchPlayerFn) {

  const $gt = addDays(new Date(), -14);

  const $match = {
    ...duelFilter,
    ts: { $gt },
  };

  const duels = await Duel.aggregate([{ $match }, { $sort: { ts: 1 } }]);

  const data = duels.map(({ winner, loser }) => matchPlayerFn(winner) || matchPlayerFn(loser));

  const playersById = lo.keyBy(data, 'id');

  return lo.map(playersById);

}

export async function tagsPlayers(tags) {

  return activePlayers({ 'players.tag': { $in: tags } }, matchPlayer);

  function matchPlayer(player) {
    if (tags.indexOf(player.tag) < 0) {
      return null;
    }
    return player;
  }

}

export async function castlePlayers(castle) {

  return activePlayers({ 'players.castle': castle }, matchPlayer);

  function matchPlayer(player) {
    if (player.castle !== castle) {
      return null;
    }
    return player;
  }

}

export function targetsFromText(text) {

  const locationTasksRe = /([ad]) ([A-z ]+ lvl[.]\d{2}|[A-Z][a-z]+ [A-Z][a-z]+)/g;

  const tasks = text.match(locationTasksRe) || [];

  if (!tasks) {
    return null;
  }

  return tasks.map(task => {
    const [, type, fullName] = task.match(/([ad]) (.+)/i);
    return { type, fullName };
  });

}

export async function findByTasks(tasks) {

  const alliances = await Alliance.find({ expired: { $ne: true } });
  const locations = await AllianceLocation.find({ expired: { $ne: true } });

  const res = tasks.map(({ fullName, type }) => {

    const re = new RegExp(lo.escapeRegExp(fullName), 'i');

    const target = lo.find(alliances, t => re.test(t.name))
      || lo.find(locations, t => re.test(t.fullName));

    return target && {
      fullName: target.fullName || target.name,
      type,
      code: target.code,
      league: playerLeague({ level: target.level }),
    };

  });

  return lo.filter(res);

}
