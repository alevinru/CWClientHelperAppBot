import { Schema, model } from 'mongoose';
import secondsDiff from 'date-fns/difference_in_seconds';

const MOB_HUNT_LIFETIME = 180;

const schema = new Schema({

  text: String,
  date: Date,
  messageId: Number,
  command: String,

  isAmbush: Boolean,

  mobs: [{
    _id: false,
    name: String,
    modifiers: [String],
    level: Number,
    cnt: Number,
  }],

  replies: [{
    messageId: Number,
    chatId: Number,
  }],

  reporter: {
    userName: String,
    userId: Number,
    firstName: String,
    lastName: String,
  },

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
schema.index({ 'replies.messageId': 1, 'replies.chatId': 1 });
schema.index({ date: 1 });
schema.method('isExpired', isExpired);

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

function isExpired() {
  return secondsToFight(this.date) < 1;
}

export function secondsToFight(date) {
  return MOB_HUNT_LIFETIME - secondsDiff(new Date(), date);
}
