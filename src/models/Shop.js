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
  guildDiscount: { type: Number, default: 0 },
  castleDiscount: { type: Number, default: 0 },
  maintenanceEnabled: Boolean,
  maintenanceCost: Number,
  qualityCraftLevel: Number,
  lastOpened: Date,
  ts: Date,
}, { collection: 'Shop' });

schema.index({ lastOpened: -1 });

export default model('Shop', schema);
