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
    expect(lines[2]).to.equal('<code>63</code> <b>2</b> x Forest Boar');

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

});
