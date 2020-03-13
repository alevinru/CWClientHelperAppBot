import { Schema, model } from 'mongoose';

const mapStateSchema = new Schema({

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
  belongsTo: String,

  atkLeaders: [String],
  defLeaders: [String],

});

const battle = {

  date: Date,
  reportDate: Date,

  results: [mapStateSchema],
  text: String,

  reportLink: String,

  ts: Date,

};

export const schema = new Schema(battle, { collection: 'AllianceMapState' });

schema.index({ date: 1 });

export default model('AllianceMapState', schema);
