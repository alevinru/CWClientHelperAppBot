import { expect, assert } from 'chai';
import { mobsFromText } from '../src/services/mobs';
import { readFile } from '../src/services/fs';

describe('Met some mob parser', function () {

  it('should parse EN text', async function () {

    const text = await readFile('static/mobsMet_en.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs.mobs).to.eql([
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

  it('should parse RU text', async function () {

    const text = await readFile('static/mobsMet_ru.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs.mobs).to.eql([
      {
        level: 62,
        name: 'Forbidden Sentinel',
      },
      {
        level: 62,
        name: 'Forbidden Sentinel',
      },
      {
        level: 62,
        name: 'Forbidden Sentinel',
        modifiers: ['armored'],
      },
    ]);

    expect(mobs.command).equal('/fight_M5ouGPgXpM43q0IMY1Zu');

  });

});
