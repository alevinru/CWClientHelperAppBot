import log from '../services/log';
import { hello } from './hello';

const { debug } = log('mw:start');

export default async function (ctx) {

  const { reply, from: { id: userId }, session } = ctx;
  debug(userId);

  if (session.auth) {
    await hello(ctx);
  } else {
    reply('Welcome to CW Helper bot! Now you need /auth to request ChatWars authorization code');
  }

}
