import { Schema, model } from 'mongoose';

const schema = new Schema({
  sellerId: String,
  sellerCastle: String,
  sellerName: String,
  buyerCastle: String,
  buyerName: String,
  buyerId: String,
  item: String,
  itemCode: String,
  qty: Number,
  price: Number,
  ts: Date,
}, {
  collection: 'Deal',
});

schema.index({ itemCode: 1, ts: -1 });
schema.index({ sellerName: 1, ts: -1 });
schema.index({ buyerName: 1, ts: -1 });
schema.index({ sellerId: 1, ts: -1 });
schema.index({ buyerId: 1, ts: -1 });

export default model('Deal', schema);

/*
{
  "sellerId": "53f3e27a124e01dcdd77de45995bf0db", // ingame userId, obtained with token
  "sellerCastle": "🦌",
  "sellerName": "Wolpertinger",
  "buyerId": "3537e9190d1d516e05cd638bb76fe66c",
  "buyerCastle": "🦌",
  "buyerName": "Guacamele",
  "item": "charcoal",
  "qty": 10,
  "price": 6
}
*/
