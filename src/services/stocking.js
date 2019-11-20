import lo from 'lodash';
import { itemCodeByName } from './cw';

export function formatStockItem(name, qty) {
  const code = itemCodeByName(name);
  const codeLabel = code ? `<code>${code || '??'}</code>` : '';
  return lo.filter(['▪', codeLabel, `${name}: ${qty}`]).join(' ');
}

const POTION_RE = /(vial|potion|bottle) of ([a-z]+)/i;

const POTIONS_ICONS_MAP = new Map([
  ['Health', '❤'],
  ['Mana', '💧'],
  ['Greed', '🤑'],
  ['Rage', '😡'],
  ['Morph', '🌀'],
  ['Nature', '🌿'],
  ['Peace', '🧘'],
  ['Twilight', '🌓'],
]);

export function potionPackInfo(stock) {

  const byType = lo.groupBy(stockArray(stock), ({ name }) => {
    const [, , type] = name.match(POTION_RE) || [];
    return type;
  });

  delete byType.undefined;

  const data = lo.map(byType, (items, potionType) => {
    return {
      potionType,
      qty: items.length === 3 ? lo.min(items.map(({ qty }) => qty)) : 0,
      icon: POTIONS_ICONS_MAP.get(potionType),
    };
  });

  return lo.orderBy(data, 'potionType');

}

export function stockArray(stock) {
  return lo.map(stock, (qty, name) => ({ name, qty }));
}
