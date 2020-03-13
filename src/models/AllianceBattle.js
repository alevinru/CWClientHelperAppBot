import { Schema, model } from 'mongoose';

const headquartersSchema = new Schema({

  _id: false,
  name: String,
  result: {
    type: String,
    enum: ['breached', 'protected'],
  },
  difficulty: {
    type: Number,
    enum: [0, 1, 2, 4],
  },
  stock: Number,
  glory: Number,

  atkLeaders: [String],
  defLeaders: [String],

});

const battle = {

  date: Date,
  reportDate: Date,

  results: [headquartersSchema],
  text: String,

  reportLink: String,

  ts: Date,

};

export const schema = new Schema(battle, { collection: 'AllianceBattle' });

schema.index({ date: 1 });

export default model('AllianceBattle', schema);
