import { QUEUE_DUELS } from 'cw-rest-api';
import { lpushAsync, ltrimAsync } from '../services/redis';
import log from '../services/log';
// import { itemKey } from '../services/cw';

const { debug, error } = log('duels');

const isNumber = /^\d+$/;

const MAX_DEALS = parseInt(process.env.MAX_DEALS, 0) || 1000;

export default async function (msg, ack) {

  const { fields, properties: { timestamp }, content } = msg;
  const { deliveryTag } = fields;
  const ts = isNumber.test(timestamp) ? new Date(timestamp * 1000) : new Date();
  const data = content.toString();
  const duel = JSON.parse(data);
  const {
    winner, loser,
  } = duel;

  duel.ts = ts.toISOString();

  const duelText = `[${winner.tag}]"${winner.name}" won [${winner.tag}]"${loser.name}"`;

  debug('Consumed', `#${deliveryTag}`, ts, duelText);

  try {
    await lpushAsync(QUEUE_DUELS, JSON.stringify(duel));
    await ltrimAsync(QUEUE_DUELS, 0, MAX_DEALS - 1);
    if (ack) {
      ack();
    }
  } catch ({ name, message }) {
    error(name, message);
  }

}
