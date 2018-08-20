import hello from './hello';

const debug = require('debug')('laa:cwb:start');

export default async function (ctx) {

  const { reply, from: { id: userId }, session } = ctx;
  debug(userId);

  if (session.auth) {
    await hello(ctx);
  } else {
    reply('Welcome to CW Helper bot! Now you need /auth to request ChatWars authorization code');
  }

}
