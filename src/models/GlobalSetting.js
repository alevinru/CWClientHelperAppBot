import { Schema, model } from 'mongoose';

const schema = new Schema({
  code: String,
  value: Object,
  ts: Date,
}, {
  collection: 'GlobalSetting',
});

schema.index({ code: 1 });

export default model('GlobalSetting', schema);
