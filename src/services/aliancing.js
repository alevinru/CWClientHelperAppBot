import lo from 'lodash';
import * as b from './battles';

export function allianceBattleView(allianceBattle) {

  const { date, reportLink } = allianceBattle;

  const resultsByStatus = lo.groupBy(allianceBattle.results, 'result');

  const resultsArray = lo.map(resultsByStatus, (results, code) => ({ results, code }));
  const orderedResults = lo.orderBy(resultsArray, ['code'], ['desc']);

  const res = [
    `<b>${b.dateFormat(date)}</b> alliances battle`,
    ...lo.map(orderedResults, ({ results, code }) => {
      return [
        '',
        `${b.resultStatus(code)} <b>${results.length}</b> ${code}`,
        '',
        ...lo.map(lo.orderBy(results, 'name'), battleResultView),
      ].join('\n');
    }),
  ];

  if (reportLink) {
    res.push('', `<a href="${b.reportLinkHref(reportLink)}">Full report</a>`);
  }

  return res;

}

function battleResultView(result) {

  const { stock, glory } = result;

  return lo.filter([
    b.difficultyStatus(result),
    `${result.name}`,
    stock && `<code>-${stock}</code>📦`,
    glory && `<code>-${glory}</code>🎖`,
  ]).join(' ');

}
