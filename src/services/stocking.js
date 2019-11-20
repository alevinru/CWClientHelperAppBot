import lo from 'lodash';
import { itemCodeByName } from './cw';

export function formatStockItem(name, qty) {
  const code = itemCodeByName(name);
  const codeLabel = code ? `<code>${code || '??'}</code>` : '';
  return lo.filter(['▪', codeLabel, `${name}: ${qty}`]).join(' ');
}

const POTION_RE = /(vial|potion|bottle) of ([a-z]+)/i;

export function potionPackInfo(stock) {

  const byType = lo.groupBy(stockArray(stock), ({ name }) => {
    const [, , type] = name.match(POTION_RE) || [];
    return type;
  });

  delete byType.undefined;

  return lo.map(byType, (items, potionType) => {
    return {
      potionType,
      qty: lo.min(items.map(({ qty }) => qty)),
    };
  });

}

export function stockArray(stock) {
  return lo.map(stock, (qty, name) => ({ name, qty }));
}
