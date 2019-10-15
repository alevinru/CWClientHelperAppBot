import { Schema, model } from 'mongoose';

const { BOT_TOKEN = '' } = process.env;
export const BOT_ID = parseInt(BOT_TOKEN.match(/^[^:]*/)[0], 0);

const schema = new Schema({
  id: Number,
  setting: Object,
  botId: Number,
  ts: Date,
}, {
  collection: 'Chat',
});

schema.index({ id: 1 });

schema.statics.saveValue = saveValue;
schema.statics.findValue = findValue;

export default model('Chat', schema);

export const CHAT_SETTING_PIN_MOBS = 'pinMobs';
export const CHAT_SETTING_MOB_HUNTING = 'mobHunting';
export const CHAT_SETTING_NOTIFY_BATTLE = 'notifyBattle';

function saveValue(chatId, name, value) {
  const key = { id: chatId, botId: BOT_ID };
  return this.updateOne(key, { $set: { [`setting.${name}`]: value } }, { upsert: true });
}

async function findValue(chatId, name) {
  const chat = await this.findOne({ id: chatId, botId: BOT_ID });
  if (!chat) {
    return undefined;
  }
  return chat.setting[name];
}
