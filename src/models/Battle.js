import { Schema, model } from 'mongoose';


/*
⛳️Сводки с полей:
🖤: 🛡👌 +120💰
🐢: 🛡👌 +70💰
🍁: 🛡👌 +34💰
🌹: 🛡👌 +20💰
🦇: ⚔️⚡️ -8053💰 -22196📦
☘️: ⚔️ -9934💰 -15664📦
🍆: ⚔️😎 -16547💰 -20003📦

🏆Очки:
🖤Скала: +82
🍁Амбер: +74
🐢Тортуга: +60
🌹Замок Рассвета: +24
🍆Ферма: +6
☘️Оплот: +2
🦇Ночной Замок: +1

Битва (https://t.me/ChatWarsDigest/4332) 02/08/19 17:00
10 Hornung 1064
 */

/*
⛳️Battle results:
🦅Highnest: 🛡👌 +152💰
🌑Moonlight: 🛡👌 +80💰
🐺Wolfpack: 🛡👌 +47💰
🐉Dragonscale: 🛡👌 +26💰
🦈Sharkteeth: 🛡👌 +8💰
🥔Potato: ⚔️ -4763💰 -7638📦
🦌Deerhorn: ⚔️😎 -11899💰 -11064📦

🏆Scores:
🦅Highnest: +25
🐉Dragonscale: +22
🦈Sharkteeth: +21
🐺Wolfpack: +20
🦌Deerhorn: +1
🌑Moonlight: +0
🥔Potato: +0

Battle (https://t.me/chtwrsreports/5537) 03/08/19 07:00
 */

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
});

const battle = {

  date: Date,
  reportDate: Date,

  results: [resultsSchema],
  result: Object,

  text: String,
  userId: Number,
  ts: Date,

};

const schema = new Schema(Object.assign({}, battle), { collection: 'Battle' });

export default model('Battle', schema);
