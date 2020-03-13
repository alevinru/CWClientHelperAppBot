import { Schema, model } from 'mongoose';

const resultsSchema = new Schema({
  _id: false,
  castle: String,
  name: String,
  code: String,
  gold: Number,
  stock: Number,
  result: String,
  ga: Boolean,
  difficulty: Number,
  score: Number,
  atk: Number,
  masterReport: {
    atk: Number,
    def: Number,
    gold: Number,
    id: Schema.Types.ObjectId,
  },
});

const battle = {

  date: Date,
  reportDate: Date,

  results: [resultsSchema],
  reportLink: String,

  text: String,
  userId: Number,
  ts: Date,

};

const schema = new Schema(Object.assign({}, battle), { collection: 'Battle' });

schema.index({ date: 1 });

export default model('Battle', schema);
