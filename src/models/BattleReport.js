import { Schema, model } from 'mongoose';

const schema = new Schema({
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
}, { collection: 'BattleReport' });

// schema.index({ lastOpened: -1 });

export default model('BattleReport', schema);
