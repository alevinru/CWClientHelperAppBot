export default function (bot) {

  Object.assign(bot.context, { replyError });

}

function replyError(tried, got) {
  const msg = `Tried ${tried} and got "${got}" error`;
  this.reply(msg);
}
