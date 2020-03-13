import * as b from '../services/battles';
import * as a from '../services/aliancing';

import AllianceBattle from '../models/AllianceBattle';

export async function showLastAllianceBattle(ctx) {
  await showAllianceBattle(ctx, b.battleDate(new Date()));
}

async function showAllianceBattle(ctx, date) {

  const filters = { date };

  const battleMongo = await AllianceBattle.findOne(filters);

  const battle = battleMongo && battleMongo.toObject();

  const reply = [];

  if (!battle) {
    reply.push(`<code>Not found</code> ${b.dateFormat(date)} battle`);
  } else {
    reply.push(...a.allianceBattleView(battle));
  }

  await ctx.replyWithHTML(reply.join('\n'), { disable_web_page_preview: true });

}
