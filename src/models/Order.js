import { Schema, model } from 'mongoose';

const collection = 'Order';

const schema = new Schema({

  id: Number,
  userId: Number,
  userName: String,
  itemCode: String,
  itemName: String,
  qty: Number,
  price: Number,
  token: String,
  ts: Date,
  botId: Number,

}, { collection });

schema.index({ id: 1 });
schema.index({ itemCode: 1, ts: -1 });
schema.index({ userId: 1, ts: -1 });

export default model(collection, schema);
