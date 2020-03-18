import replace from 'lodash/replace';
import escapeRegExp from 'lodash/escapeRegExp';
import lo from 'lodash';

const MAX_REGEX_LENGTH = 50;

export function searchRe(text) {

  if (text.length > MAX_REGEX_LENGTH) {
    throw new Error(`${text.length} symbols is too much for a filter`);
  }

  const isRe = text.match(/\/(.+)\//);

  const reText = isRe ? isRe[1] : replace(escapeRegExp(text), /[ _]/g, '.+');

  return new RegExp(reText, 'i');

}


export async function isChatAdmin(ctx) {
  const { chat, from } = ctx;
  if (chat.id === from.id) {
    return true;
  }
  const admins = await ctx.telegram.getChatAdministrators(chat.id);
  return !lo.find(admins, { id: from.id });
}
