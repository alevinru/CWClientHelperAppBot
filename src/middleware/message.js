const { PHRASE_NOT_IMPLEMENTED } = process.env || 'What ?';

const debug = require('debug')('laa:cwb:message');

export default async function (ctx, next) {

  await next();

  const {
    message,
    message: { forward_from: forwardFrom, text },
    from: { id: userId },
    chat: { id: chatId },
    reply,
  } = ctx;

  if (chatId !== userId) {
    debug('ignore group chat message:', text);
    return;
  }

  debug('from:', userId, forwardFrom, text);
  debug(JSON.stringify(message, ' ', 2));
  reply(PHRASE_NOT_IMPLEMENTED);

}
