import { CW_BOT_ID } from '../services/cw';

// const debug = require('debug')('laa:cwb:filters');

export function forwardFilter(ctx) {
  return !!ctx.message.forward_from;
}

export function fromCWFilter(ctx) {

  if (!forwardFilter(ctx)) {
    return false;
  }

  const { forward_from: from } = ctx.message;
  // debug('fromCWFilter', from);
  return from.id === CW_BOT_ID;

}
