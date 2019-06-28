import map from 'lodash/map';
import mapValues from 'lodash/mapValues';

import User from '../models/User';
import log from '../services/log';

const { debug } = log('mw:settings');

export default async function (ctx) {

  const { from: { id: userId } } = ctx;

  const user = await User.findOne({ id: userId });

  if (!user) {
    return;
  }

  const { settings = {} } = user;

  await ctx.replyWithHTML(formatSettings(applyDefaults(settings)));

}

export async function setValue(ctx) {

  const { from: { id: userId }, match } = ctx;

  const [, key, val] = match;

  debug('setValue', key, val);

  const user = await User.findOne({ id: userId });

  if (!user) {
    return;
  }

  const newValue = checkSetting(key, val);

  user.settings[key] = newValue;

  await user.save();

  await ctx.replyWithHTML(formatSettings({ key: newValue }));

}


function checkSetting(key, val) {

  const setting = allSettings()[key];

  if (!setting) {
    throw new Error(`Unknown setting <code>${key}</code>`);
  }

  switch (setting.type) {
    case Boolean:
      return /^(0|false)$/.test(val) ? false : !!val;
    case String:
      return val.toString();
    default:
      throw new Error('Unknown setting type');
  }

}


function applyDefaults(settings) {
  return mapValues(allSettings(), ({ defaults }, key) => settings[key] || defaults);
}

function formatSettings(settings) {
  return map(settings, (val, key) => {
    return `▪ <code>${key}</code>: <b>${val}</b>`;
  }).join('\n');
}

function allSettings() {
  return {
    notifyOrderFail: {
      type: Boolean,
      defaults: true,
    },
  };
}
