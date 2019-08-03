import { Schema, model } from 'mongoose';

const battle = {
  tag: String,
  name: String,
  castle: String,
  date: Date,
  reportDate: Date,
  text: String,
  stats: Object,
  exp: Number,
  gold: Number,
  hp: Number,
  userId: Number,
  results: Array,
  effects: Object,
  ts: Date,
};

const schema = new Schema(Object.assign({}, battle), { collection: 'BattleReport' });

export default model('BattleReport', schema);

const mobSchema = new Schema(Object.assign({
  hit: Number,
  miss: Number,
  lastHit: Number,
}, battle), { collection: 'MobBattleReport' });

export const MobBattleReport = model('MobBattleReport', mobSchema);
