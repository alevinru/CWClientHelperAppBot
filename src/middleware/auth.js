import { cw } from '../services/cw';

const debug = require('debug')('laa:cwb:auth');

export default async function ({ reply, from: { id: userId } }) {

  debug(userId);

  try {
    await cw.sendAuth(userId);
    reply(`Auth sent to ${userId} forward this message back here to complete authorization`);
  } catch (err) {
    reply('Something went wrong, auth failed');
    debug('Error:', err);
  }

}
