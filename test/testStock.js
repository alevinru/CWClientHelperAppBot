import { expect, assert } from 'chai';
// import lo from 'lodash';
import { readJsonFile } from '../src/services/fs';
import * as shopping from '../src/services/stocking';

describe('Stock service', function () {

  it('should find potion packs', async function () {

    const stock = await readJsonFile('./static/stock.json');
    const packs = shopping.potionPackInfo(stock);

    expect(packs).to.eql([
      { potionType: 'Mana', qty: 5 },
      { potionType: 'Morph', qty: 5 },
      { potionType: 'Peace', qty: 2 },
      { potionType: 'Rage', qty: 1 },
      { potionType: 'Greed', qty: 1 },
      { potionType: 'Nature', qty: 7 }],
    );

  });

});
