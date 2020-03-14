import { Schema, model } from 'mongoose';

const alliance = {

  name: String,
  code: String,
  tags: [String],

  ts: Date,
  cts: Date,

};

export const schema = new Schema(alliance, { collection: 'Alliance' });

schema
  .index({ code: 1 })
  .index({ name: 1 });

export default model('Alliance', schema);
