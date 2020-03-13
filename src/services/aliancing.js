import lo from 'lodash';
import * as b from './battles';

export function allianceBattleView(allianceBattle) {

  const { date, results, reportLink } = allianceBattle;

  const resultsByStatus = lo.groupBy(results, 'result');

  const res = [
    `<b>${b.dateFormat(date)}</b> alliances battle`,
    ...lo.map(resultsByStatus, (r, code) => {
      return [
        '',
        `${b.resultStatus(code)} <b>${r.length}</b> ${code}`,
        '',
        ...lo.map(lo.orderBy(r, 'name'), battleResultView),
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
    glory && `<code>-${glory}</code>🏆`,
  ]).join(' ');

}
