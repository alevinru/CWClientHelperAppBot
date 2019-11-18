import { Schema, model } from 'mongoose';
import lo from 'lodash';

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
schema.statics.findSettings = findSettings;

export default model('Chat', schema);

export const CHAT_SETTING_PIN_MOBS = 'pinMobs';
export const CHAT_SETTING_MOB_HUNTING = 'mobHunting';
export const CHAT_SETTING_NOTIFY_BATTLE = 'notifyBattle';
export const CHAT_SETTING_HELPERS_MIN_HP = 'helpersMinHp';

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

async function findSettings(chatId) {
  const chat = await this.findOne({ id: chatId, botId: BOT_ID });
  if (!chat) {
    return [];
  }
  return lo.map(chat.setting, (value, name) => {
    // should check
    return { name, value };
  });
}
