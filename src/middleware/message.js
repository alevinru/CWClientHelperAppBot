const { PHRASE_NOT_IMPLEMENTED } = process.env || 'What ?';

const debug = require('debug')('laa:cwb:message');

export default async function (ctx, next) {

  await next();

  const {
    message: { forward_from: forwardFrom, text },
    from: { id: userId },
    reply,
  } = ctx;

  debug('from:', userId, forwardFrom, text);
  reply(PHRASE_NOT_IMPLEMENTED);

}
