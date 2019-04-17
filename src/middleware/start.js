import log from '../services/log';
import { hello } from './hello';

const { debug } = log('mw:start');

export default async function (ctx) {

  const { reply, from: { id: userId }, session } = ctx;
  debug(userId);

  if (session.auth) {
    await hello(ctx);
  } else {
    reply([
      'Welcome to CW Helper bot!',
      'You may need /auth if you want to use some ChatWars specific features',
    ].join('\n'));
  }

}
