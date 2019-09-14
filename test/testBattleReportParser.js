import { expect, assert } from 'chai';
import { readFile } from '../src/services/fs';
import { battleFromText } from '../src/services/battles';

describe('Battle reports parser', function () {

  it('should parse reports', async function () {

    const text = await readFile('static/battleReport_ru.txt');
    assert(text, 'No sample battle found');

    const battle = battleFromText(text.toString());

    const { stats, effects, tag, name, exp } = battle;

    expect(tag).equal('13G');
    expect(name).equal('[13G]Кузоман');
    expect(exp).equal(815);

    expect(stats).to.eql(
      {
        atk: 718,
        def: 407,
        healAtk: 0,
        healDef: 0,
        level: 69,
      }
    );

    expect(effects).to.eql({
      medal: 'Enraged alchemist',
    });

  });

});
