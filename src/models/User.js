import { Schema, model } from 'mongoose';

const schema = new Schema({
  id: String,
  firstName: String,
  lastName: String,
  username: String,
  profile: Object,
  gear: Object,
  trusts: Object,
  ts: Date,
}, {
  collection: 'User',
});

schema.index({ id: 1 });
schema.index({ guildTag: 1 });

export default model('User', schema);
