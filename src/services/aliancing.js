import lo from 'lodash';
import * as b from './battles';

// import Alliance from '../models/Alliance';
// import AllianceLocation from '../models/AllianceLocation';
// import AllianceBattle from '../models/AllianceBattle';
import AllianceMapState from '../models/AllianceMapState';

import log from './log';
import AllianceBattle from '../models/AllianceBattle';

const { debug } = log('mw:alliance');

debug('alliance-ing');

export async function allianceLocations(alliance) {

  if (!alliance) {
    return null;
  }

  const battles = await AllianceMapState.find({
    results: { $elemMatch: { belongsTo: alliance.name } },
  }, { 'results.$': 1, date: 1 })
    .sort({ date: -1 });

  const namesArray = battles.map(({ date, results: [{ name }] }) => ({ name, date }));

  const names = lo.keyBy(namesArray, 'name');

  // debug(lo.map(names, lo.identity));

  return lo.map(names);

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
    `<b>${b.dateFormat(date)}</b> alliances battle`,
    '',
    `<a href="${b.reportLinkHref(reportLink)}">Headquarters report</a>`,
    '',
    ...lo.map(orderedResults, battleResultView),
  ];

}


export function allianceMapStateView(allianceMapState) {

  const { reportLink, results } = allianceMapState;

  const orderedResults = lo.orderBy(results, 'name');

  return [
    `<a href="${b.reportLinkHref(reportLink)}">Map state report</a>`,
    '',
    ...lo.map(orderedResults, mapStateResultView),
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
    belongsTo && `🚩 ${belongsTo}`,
  ]).join(' ');

}

export function allianceTagTasksView({ tag, tasks }, targets = new Map()) {

  return [
    `<b>${tag}</b>`,
    tasks.map(({ target, names }) => {
      const alliance = targets.get(target);
      const atk = alliance ? `/ga_atk_${alliance}` : target;
      return [
        `<a href="http://t.me/share/url?url=${atk}">${target}</a>`,
        '👉',
        names.join(', '),
      ].join(' ');
    }).join('\n\n'),
  ];

}

export function atkLink(name, code) {
  return `<a href="http://t.me/share/url?url=/ga_atk_${code}">${name}</a>`;
}

const TASK_LINE_RE = /^(.{2,3})[ \t]+(.+)[ \t]+(.+ .+)$/;

export function parseAllianceTask(text) {

  const lines = text.split('\n');

  const tasks = lines.map(line => {
    const [, tag, name, target] = line.match(TASK_LINE_RE) || [];
    return tag && name && target && { tag, name, target };
  });

  return lo.filter(tasks);

}

export function allianceTasksByTag(tasks) {

  const byTag = lo.groupBy(tasks, 'tag');

  const res = lo.map(byTag, (tagTasks, tag) => {
    const byTarget = lo.groupBy(tagTasks, 'target');
    const byTargetArray = lo.map(byTarget, (names, target) => ({
      target,
      names: lo.map(lo.orderBy(names, 'name'), ({ name }) => lo.trim(name)),
    }));
    return {
      tag,
      tasks: lo.orderBy(byTargetArray, 'target'),
    };
  });

  return lo.orderBy(res, 'tag');

}
