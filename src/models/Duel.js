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

schema.index({ ts: -1 });

schema.index({ 'winner.name': 1, ts: -1 });
schema.index({ 'loser.name': 1, ts: -1 });
schema.index({ 'winner.tag': 1, ts: -1 });
schema.index({ 'loser.tag': 1, ts: -1 });

export default model('Duel', schema);
