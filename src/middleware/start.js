const debug = require('debug')('laa:cwb:start');

export default async function ({ reply, from: { id: userId } }) {

  debug(userId);

  reply('Welcome to CW Helper bot! Now you need /auth to request ChatWars authorization code');

}
