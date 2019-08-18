import { expect, assert } from 'chai';
import { mobsFromText } from '../src/services/mobs';
import { readFile } from '../src/services/fs';

describe('Met some mob parser', function () {

  it('should parse message text', async function () {

    const text = await readFile('static/mobsMet.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs).to.eql([
      {
        level: 68,
        modifiers: ['armored'],
        name: 'Forbidden Knight',
      },
      {
        level: 68,
        modifiers: ['enraged', 'armored'],
        name: 'Forbidden Knight',
      },
      {
        level: 61,
        name: 'Forbidden Knight',
      },
    ]);

  });

});
