import { Schema, model } from 'mongoose';

const { BOT_TOKEN } = process.env;
export const BOT_ID = parseInt(BOT_TOKEN.match(/^[^:]*/)[0], 0);

const schema = new Schema({
  id: String,
  firstName: String,
  lastName: String,
  username: String,
  profile: Object,
  gear: Object,
  trusts: Object,
  ts: Date,
  botSettings: {
    [BOT_ID]: {
      type: Object,
      default: {},
    },
  },
}, {
  collection: 'User',
});

schema.index({ id: 1 });
schema.index({ guildTag: 1 });

schema.virtual('settings')
  .get(getSettings)
  .set(setSettings);

export default model('User', schema);

function setSettings(settings) {
  if (!this.botSettings) {
    this.botSettings = {};
  }
  this.botSettings[BOT_ID] = settings;
}

function getSettings() {
  if (!this.botSettings) {
    this.botSettings = {};
  }
  if (!this.botSettings[BOT_ID]) {
    this.botSettings[BOT_ID] = {};
  }
  return this.botSettings[BOT_ID];
}
