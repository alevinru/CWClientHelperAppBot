import { Schema, model } from 'mongoose';
import pick from 'lodash/fp/pick';

const schema = new Schema({
  winner: Object,
  loser: Object,
  isChallenge: Boolean,
  isGuildDuel: Boolean,
  players: Array,
  ts: Date,
}, {
  collection: 'Duel',
});

schema.index({ ts: -1 });

schema.index({ 'winner.name': 1, ts: -1 });
schema.index({ 'loser.name': 1, ts: -1 });
schema.index({ 'winner.tag': 1, ts: -1 });
schema.index({ 'loser.tag': 1, ts: -1 });

schema.index({ 'players.tag': 1, ts: -1 });
schema.index({ 'players.name': 1, ts: -1 });
schema.index({ 'players.id': 1, ts: -1 });
schema.index({ 'players.castle': 1, ts: -1 });

const playerColumns = pick(['id', 'name', 'tag', 'castle']);

schema.pre('save', setPlayers);

export default model('Duel', schema);

async function setPlayers() {
  this.players = [
    playerColumns(this.winner),
    playerColumns(this.loser),
  ];
}
