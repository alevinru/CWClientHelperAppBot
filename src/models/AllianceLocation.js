import { Schema, model } from 'mongoose';

const allianceLocation = {

  name: String,
  code: String,
  level: Number,

  ts: Date,
  cts: Date,
  reporter: Object,

};

export const schema = new Schema(allianceLocation, { collection: 'AllianceLocation' });

schema
  .index({ code: 1 })
  .index({ name: 1 });


schema.virtual('fullName')
  .get(fullName);

function fullName() {
  return `${this.name} lvl.${this.level}`;
}

export default model('AllianceLocation', schema);
