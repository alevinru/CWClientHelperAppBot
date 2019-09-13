import replace from 'lodash/replace';
import escapeRegExp from 'lodash/escapeRegExp';

const MAX_REGEX_LENGTH = 50;

export function searchRe(text) {

  if (text.length > MAX_REGEX_LENGTH) {
    throw new Error(`${text.length} symbols is too much for a filter`);
  }

  const isRe = text.match(/\/(.+)\//);

  const reText = isRe ? isRe[1] : replace(escapeRegExp(text), /[ _]/g, '.+');

  return new RegExp(reText, 'i');

}
