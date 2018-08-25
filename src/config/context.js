export default function (bot) {

  Object.assign(bot.context, {
    replyError,
    replyJson,
    replyMD,
    replyHTML,
    replyPlain,
  });

}

function replyError(tried, got) {

  const { message, name } = got;
  const res = message && name ? `${name.toLocaleLowerCase()}: <b>${message}</b>` : `<b>${got}</b>`;

  return replyHTML.call(this, `⚠️ Tried ${tried} and got ${res}`);

}

function replyPlain(plain) {
  return this.reply(arrayToText(plain));
}

function replyJson(obj) {
  return this.reply(JSON.stringify(obj, ' ', 2), { parse_mode: 'HTML' });
}

function replyMD(markdown) {
  return this.reply(arrayToText(markdown), { parse_mode: 'Markdown' });
}

function replyHTML(html) {
  return this.reply(arrayToText(html), { parse_mode: 'HTML' });
}


function arrayToText(arrayOrString) {
  return Array.isArray(arrayOrString) ? arrayOrString.join('') : arrayOrString;
}
