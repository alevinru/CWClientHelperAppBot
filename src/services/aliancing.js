import lo from 'lodash';
import * as b from './battles';

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

export function allianceTagTasksView({ tag, tasks }) {

  return [
    `<b>${tag}</b>`,
    tasks.map(({ target, names }) => {
      return [
        `<a href="http://t.me/share/url?url=${target}">${target}</a>`,
        '👉',
        names.join(', '),
      ].join(' ');
    }).join('\n\n'),
  ];

}

const TASK_LINE_RE = /^(.{2,3})[ \t]+([^/]+)[ \t]+(\/.+)$/;

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
