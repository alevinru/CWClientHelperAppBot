import { Schema, model } from 'mongoose';

const schema = new Schema({

  text: String,
  date: Date,
  messageId: Number,
  command: String,

  mobs: [{
    _id: false,
    name: String,
    modifiers: [String],
  }],

  reply: {
    messageId: Number,
    chatId: Number,
  },

}, {
  collection: 'MobHunt',
});

schema.index({ command: 1 }, { unique: true });
schema.index({ messageId: 1 });
schema.index({ date: 1 });

export default model('MobHunt', schema);
