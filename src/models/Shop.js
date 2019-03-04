import { Schema, model } from 'mongoose';

const schema = new Schema({
  _id: String,
  link: String,
  name: String,
  ownerName: String,
  ownerCastle: String,
  kind: String,
  mana: Number,
  offers: Array,
  specialization: Object,
  guildDiscount: Number,
  castleDiscount: Number,
  ts: Date,
}, { collection: 'Shop' });

export default model('Shop', schema);
