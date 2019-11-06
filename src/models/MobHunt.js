import { Schema, model } from 'mongoose';
import secondsDiff from 'date-fns/difference_in_seconds';

const MOB_HUNT_LIFETIME = parseInt(process.env.MOB_HUNT_LIFETIME, 0) || 180;
const MOB_HUNT_CHAMPION_LIFETIME = MOB_HUNT_LIFETIME + 120;

const playerSchema = {
  _id: false,
  userName: String,
  userId: Number,
  firstName: String,
  lastName: String,
  hp: Number,
  streak: Number,
  level: Number,
};

const schema = new Schema({

  text: String,
  date: Date,
  messageId: Number,
  command: String,

  isAmbush: Boolean,
  isCheaters: Boolean,
  level: Number,

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

  reporter: playerSchema,

  helper: playerSchema,

  helpers: [playerSchema],

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
  return secondsToFight(this.date, this.isAmbush) < 1;
}

export function secondsToFight(date, isChampion = false) {
  const lifetime = isChampion ? MOB_HUNT_CHAMPION_LIFETIME : MOB_HUNT_LIFETIME;
  return lifetime - secondsDiff(new Date(), date);
}
