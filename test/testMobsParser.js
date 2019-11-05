import { expect, assert } from 'chai';
import { mobsFromText } from '../src/services/mobs';
import { readFile } from '../src/services/fs';
import lo from 'lodash';

describe('Met some mob parser', function () {

  it('should parse EN multi text', async function () {

    const text = await readFile('static/mobsMulti_en.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs.mobs).to.eql([
      {
        level: 63,
        cnt: 2,
        name: 'Forest Boar',
      },
    ]);

  });

  it('should parse RU ambush text', async function () {

    const text = await readFile('static/ambush_ru.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    assert(mobs.isAmbush, 'ambush expected');

    expect(lo.last(mobs.mobs)).to.eql({
      level: 73,
      cnt: 2,
      name: 'Forbidden Knight',
    });

  });


  it('should parse EN text', async function () {

    const text = await readFile('static/mobsMet_en.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs.mobs).to.eql([
      {
        cnt: 1,
        level: 68,
        modifiers: ['armored'],
        name: 'Forbidden Knight',
      },
      {
        cnt: 1,
        level: 68,
        modifiers: ['enraged', 'armored'],
        name: 'Forbidden Knight',
      },
      {
        cnt: 1,
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
        cnt: 1,
        level: 62,
        name: 'Forbidden Sentinel',
      },
      {
        cnt: 1,
        level: 62,
        name: 'Forbidden Sentinel',
      },
      {
        cnt: 1,
        level: 62,
        name: 'Forbidden Sentinel',
        modifiers: ['armored'],
      },
    ]);

    expect(mobs.command).equal('/fight_M5ouGPgXpM43q0IMY1Zu');

  });

  it('should parse RU cheaters', async function () {

    const text = await readFile('static/cheatersClub_ru.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs).to.eql({
      command: '/fight_HkUaxPKdrZ1M0JLGspN9',
      isAmbush: false,
      isCheaters: true,
      level: 57,
      mobs: [],
    });

  });

  it('should parse EN cheaters', async function () {

    const text = await readFile('static/cheatersClub_EN.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    expect(mobs).to.eql({
      command: '/fight_KQ3LE5S7bedRUIziU37U',
      isAmbush: false,
      isCheaters: true,
      level: 39,
      mobs: [],
    });

  });

});
