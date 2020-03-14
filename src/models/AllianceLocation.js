import { Schema, model } from 'mongoose';

const allianceLocation = {

  name: String,
  code: String,
  level: Number,
  fullName: String,

  ts: Date,
  cts: Date,
  reporter: Object,

};

export const schema = new Schema(allianceLocation, { collection: 'AllianceLocation' });

schema
  .index({ code: 1 })
  .index({ name: 1 });

export default model('AllianceLocation', schema);
