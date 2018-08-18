export default function (bot) {

  Object.assign(bot.context, {
    replyError,
    replyJson,
    replyMD,
    replyHTML,
  });

}

function replyError(tried, got) {

  const { message, name } = got;
  const res = message && name ? `${name.toLocaleLowerCase()}: <b>${message}</b>` : `<b>${got}</b>`;

  return replyHTML.call(this, `⚠️ Tried ${tried} and got ${res}`);

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
