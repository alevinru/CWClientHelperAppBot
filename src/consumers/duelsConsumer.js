import log from '../services/log';
import Duel from '../models/Duel';

const { debug, error } = log('duels');

const isNumber = /^\d+$/;

export default async function (msg, ack) {

  const { fields, properties: { timestamp }, content } = msg;
  const { deliveryTag } = fields;
  const ts = isNumber.test(timestamp) ? new Date(timestamp * 1000) : new Date();
  const data = content.toString();
  const duel = JSON.parse(data);
  const { winner, loser } = duel;

  duel.ts = ts.toISOString();

  const duelText = `[${winner.tag || '-'}]"${winner.name}" won [${winner.tag || '-'}]"${loser.name}"`;

  debug('Consumed', `#${deliveryTag}`, ts, duelText);

  try {

    await Duel.create(duel);

    if (ack) {
      ack();
    }

  } catch ({ name, message }) {
    error(name, message);
  }

}
