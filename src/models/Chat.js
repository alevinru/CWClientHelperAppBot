import { Schema, model } from 'mongoose';

const schema = new Schema({
  id: Number,
  setting: Object,
  ts: Date,
}, {
  collection: 'Chat',
});

schema.index({ id: 1 });

export default model('Chat', schema);
