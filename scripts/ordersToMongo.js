import lo from 'lodash';
import { eachSeriesAsync } from 'sistemium-telegram/services/async';
import * as mongo from '../src/models';
import log from '../src/services/log';
import * as redis from '../src/services/redis';

import Order from '../src/models/Order';

const ID_TO_ITEM_CODE_HASH = 'orders_idx_itemCode';

const { debug, error } = log('orders2mng');

redis.client.on('connect', () => {
  run().catch(error);
});

async function run() {

  await mongo.connect();
  const idx = await redis.hgetallAsync(ID_TO_ITEM_CODE_HASH);
  const orderIds = Object.keys(idx);

  await eachSeriesAsync(orderIds, async id => {
    const order = await redis.hgetallAsync(`order_${id}`);
    debug(id, order.itemName, order.userName);
    await Order.create(order);
  });

  await mongo.disconnect();
  process.exit();

}
