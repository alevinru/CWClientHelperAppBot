import { Schema, model } from 'mongoose';

const schema = new Schema({
  // _id: String,
  lotId: String,
  itemName: String,
  quality: String,
  sellerName: String,
  sellerCastle: String,
  buyerName: String,
  buyerCastle: String,
  endAt: Date,
  startedAt: Date,
  price: Number,
  stats: Object,
  ts: Date,
}, { collection: 'Auction' });

export default model('Auction', schema);

/*

{
    "lotId": "71499",
    "itemName": "Hunter dagger",
    "sellerName": "E them Up",
    "quality": "Fine",
    "sellerCastle": "🦌",
    "endAt": "2018-07-15T20:23:38.217Z",
    "startedAt": "2018-07-15T16:20:16.851Z",
    "buyerCastle": "🦌",
    "buyerName": "Shortspear", // only for finished auctions
    "price": 9,
    "stats" : {
        "⚔": 4,
        "🎒": 3
    }
  }

*/
