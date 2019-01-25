import Router from 'koa-router';
import * as CW from 'cw-rest-api';

import log from '../../services/log';
import { hgetAsync, lrangeAsync } from '../../services/redis';
import { dealsKey } from '../../consumers/dealsConsumer';

const { debug, error } = log('rest:api');

const router = new Router();

export default router;

router.get('/deals/:itemCode', async ctx => {

  const { params: { itemCode }, header: { authorization } } = ctx;

  debug('GET /deals', itemCode, authorization);

  try {

    const data = await lrangeAsync(dealsKey(itemCode), 0, -1);

    ctx.body = data.map(JSON.parse);

  } catch (err) {
    ctx.response.status = 500;
    error(err.name, err.message);
  }

});

router.get('/au', async ctx => {

  // const { params: { itemCode }, header: { authorization } } = ctx;

  debug('GET /au');

  try {

    const data = await hgetAsync(CW.QUEUE_AU, 'data');

    ctx.body = JSON.parse(data);

  } catch (err) {
    ctx.response.status = 500;
    error(err.name, err.message);
  }

});
