import { Schema, model } from 'mongoose';

const schema = new Schema({
  winner: Object,
  loser: Object,
  isChallenge: Boolean,
  isGuildDuel: Boolean,
  ts: Date,
}, {
  collection: 'Duel',
});

export default model('Duel', schema);
