import lo from 'lodash';
import { itemCodeByName } from './cw';

export function formatStockItem(name, qty, itemCodes) {
  const index = itemCodesIndex(itemCodes);
  const codes = index[name] || [itemCodeByName(name) || '??'];
  let qtyLeft = qty;
  let isUncertain = false;
  return lo.map(lo.orderBy(codes, customFirst), (code, idx) => {
    const codeLabel = code ? `<code>${code || '??'}</code>` : '';

    const isCustom = codeIsCustom(code);
    const isLast = (idx + 1) === codes.length;
    let localQty = (isCustom && 1) || (!isUncertain && isLast && qtyLeft);

    if (localQty) {
      qtyLeft -= localQty;
    } else {
      isUncertain = true;
      localQty = `1 to ${qtyLeft}`;
    }

    return lo.filter(['▪', codeLabel, `${name}: ${localQty}`]).join(' ');

  }).join('\n');
}

function codeIsCustom(code) {
  return code.match(/^u\d+/);
}

function customFirst(code) {
  return codeIsCustom(code) ? `_${code}` : code;
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
      items: lo.mapValues(lo.keyBy(items, item => {
        const [, name] = item.name.match(POTION_RE);
        return lo.lowerCase(name);
      }), 'qty'),
    };
  });

  return lo.orderBy(lo.filter(data, 'icon'), 'potionType');

}

export function stockArray(stock) {
  return lo.map(stock, (qty, name) => ({ name, qty }));
}

function itemCodesIndex(itemCodes) {
  const mapped = lo.map(itemCodes, (name, code) => ({ name, code }));
  return lo.mapValues(lo.groupBy(mapped, 'name'), items => lo.map(items, 'code'));
}
