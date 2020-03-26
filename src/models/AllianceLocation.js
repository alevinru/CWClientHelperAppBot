import { Schema, model } from 'mongoose';

const allianceLocation = {

  name: String,
  code: String,
  level: Number,
  expired: Boolean,

  ts: Date,
  cts: Date,
  reporter: Object,

};

const schema = new Schema(allianceLocation, { collection: 'AllianceLocation' });

schema
  .index({ code: 1 })
  .index({ name: 1 });


schema.virtual('fullName')
  .get(fullName);

schema.virtual('locationType')
  .get(locationType);

schema.virtual('locationIcon')
  .get(locationIcon);

schema.virtual('locationBonus')
  .get(locationBonus);

function fullName() {
  return `${this.name} lvl.${this.level}`;
}

export function locationType() {
  const [, type] = this.name.match(/([^ ]+)( lvl|$)/);
  return type.toLowerCase();
}

export function locationIcon() {
  switch (this.locationBonus) {
    case 'glory':
      return '🎖';
    case 'magic':
      return '💍';
    case 'resources':
      return '📦';
    default:
      return null;
  }
}

export function locationBonus() {
  switch (this.locationType) {
    case 'fort':
    case 'tower':
    case 'outpost':
      return 'glory';
    case 'ruins':
      return 'magic';
    case 'mine':
      return 'resources';
    default:
      return null;
  }
}

export default model('AllianceLocation', schema);
