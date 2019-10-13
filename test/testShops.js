import { expect, assert } from 'chai';
// import lo from 'lodash';
import * as mongo from '../src/models';
import * as shopping from '../src/services/shopping';

describe('Shopping service', function () {

  before(async function () {
    assert(process.env.MONGO_URL, 'Must be set MONGO_URL variable');
    await mongo.connect();
  });

  it('should find gurus', async function () {

    const gurus = await shopping.gurus();

    console.log(gurus[0]);

    expect(gurus).to.be.instanceOf(Array);
    expect(gurus.length).to.equal(7);

  });

  after(async function () {
    await mongo.disconnect();
  });

});
