import { expect, assert } from 'chai';
import { mobOfferView, mobsFromText } from '../src/services/mobs';
import { readFile } from '../src/services/fs';

describe('Met some mob parser', function () {

  it('should parse EN multi text', async function () {

    const text = await readFile('static/mobsMulti_en.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    const view = mobOfferView({ ...mobs, date: new Date() });

    const lines = view.text.split('\n');

    expect(lines[0]).to.equal('🐗 fight in <b>03:00</b>');
    expect(lines[1]).to.equal('');
    expect(lines[2]).to.equal('<code>63</code> 🐗 Forest Boar x 2⃣');

  });

  it('should parse EN multi text', async function () {

    const text = await readFile('static/mobsMet_en.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    const view = mobOfferView({ ...mobs, date: new Date() });

    const lines = view.text.split('\n');

    expect(lines[0]).to.equal('👾 fight in <b>03:00</b>');
    expect(lines[1]).to.equal('');
    expect(lines[2]).to.equal('<code>68</code> Forbidden Knight 🛡');

  });

  it('should parse RU ambush text', async function () {

    const text = await readFile('static/ambush_ru.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    const view = mobOfferView({ ...mobs, date: new Date() });

    const lines = view.text.split('\n');

    expect(lines[0]).to.equal('Ambush 👾 fight in <b>05:00</b>');
    expect(lines[1]).to.equal('');
    expect(lines[2]).to.equal('<code>70</code> Forbidden Collector 💰');

  });

  it('should parse RU cheaters text', async function () {
    const text = await readFile('static/cheatersClub_ru.txt');
    assert(text, 'No sample text found');

    const mobs = mobsFromText(text.toString());

    const view = mobOfferView({ ...mobs, date: new Date() });
    console.log(JSON.stringify(view, null, 2));

    const lines = view.text.split('\n');

    expect(lines[0]).to.equal('🎃 Cheaters fight in <b>03:00</b>');

  });

});
