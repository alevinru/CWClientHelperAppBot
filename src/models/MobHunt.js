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
    level: Number,
  }],

  replies: [{
    messageId: Number,
    chatId: Number,
  }],

  helper: {
    userName: String,
    userId: Number,
    firstName: String,
    lastName: String,
  },

}, {
  collection: 'MobHunt',
});

schema.index({ command: 1 }, { unique: true });
schema.index({ messageId: 1 });
schema.index({ date: 1 });

export default model('MobHunt', schema);

export const modifiersMap = new Map([
  ['blunt resist', '🔨'],
  ['spear resist', '🔱'],
  ['enraged', '😡'],
  ['toughness', '👊'],
  ['remedy bottles', '❤️'],
  ['poison bottles', '☠️️'],
  ['armored', '🛡'],
  ['golem minion', '🤖'],
  ['sword resist', '⚔️'],
  ['wealthy', '💰'],
]);
