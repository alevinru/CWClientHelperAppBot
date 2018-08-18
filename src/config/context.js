export default function (bot) {

  Object.assign(bot.context, {
    replyError,
    replyJson,
    replyMD,
    replyHTML,
  });

}

function replyError(tried, got) {
  const msg = `Tried ${tried} and got <b>${got}</b>`;
  return this.reply(msg, { parse_mode: 'HTML' });
}

function replyJson(obj) {
  const msg = `${JSON.stringify(obj, ' ', 2)}`;
  return this.reply(msg, { parse_mode: 'HTML' });
}

function replyMD(markdown) {
  return this.reply(markdown, { parse_mode: 'Markdown' });
}

function replyHTML(html) {
  return this.reply(html, { parse_mode: 'HTML' });
}
