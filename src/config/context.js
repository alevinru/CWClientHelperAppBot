export default function (bot) {

  Object.assign(bot.context, {
    replyError,
    replyJson,
  });

}

function replyError(tried, got) {
  const msg = `Tried ${tried} and got <b>${got}</b> error`;
  this.reply(msg, { parse_mode: 'HTML' });
}

function replyJson(obj) {
  const msg = `${JSON.stringify(obj, ' ', 2)}`;
  this.reply(msg, { parse_mode: 'HTML' });
}
