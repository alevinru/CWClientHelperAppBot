import log from '../services/log';

const { PHRASE_NOT_IMPLEMENTED } = process.env || 'What ?';

const { debug } = log('mw:message');

export default async function (ctx, next) {

  await next();

  const {
    message,
    message: { forward_from: forwardFrom, text },
    from: { id: userId, username },
    chat: { id: chatId, title },
    reply,
  } = ctx;

  if (chatId !== userId) {
    debug('ignore:', `"${title}"`, `@${username}`, text);
    return;
  }

  debug('from:', userId, forwardFrom, text);
  debug(JSON.stringify(message, ' ', 2));
  reply(PHRASE_NOT_IMPLEMENTED);

}
