import { Schema, model } from 'mongoose';

const schema = new Schema({
  id: Number,
  setting: Object,
  ts: Date,
}, {
  collection: 'Chat',
});

schema.index({ id: 1 });

schema.statics.saveValue = saveValue;
schema.statics.findValue = findValue;

export default model('Chat', schema);


function saveValue(chatId, name, value) {
  return this.updateOne({ id: chatId }, { $set: { [`setting.${name}`]: value } }, { upsert: true });
}

async function findValue(chatId, name) {
  const chat = await this.findOne({ id: chatId });
  if (!chat) {
    return undefined;
  }
  return chat.setting[name];
}
