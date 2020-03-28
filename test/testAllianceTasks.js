import { expect, assert } from 'chai';
import { readFile } from '../src/services/fs';
import * as ali from '../src/services/aliancing';
import * as mongo from '../src/models';

describe('Battle tasks parser', function () {

  before(async function () {
    assert(process.env.MONGO_URL, 'Must be set MONGO_URL variable');
    await mongo.connect();
  });

  it('should parse text', async function () {

    const text = await readFile('static/allianceTasks.txt');

    const tasks = ali.parseAllianceTask(text.toString());

    expect(tasks).to.be.instanceOf(Array);
    expect(tasks.length).to.equal(81);

    const byTag = ali.allianceTasksByTag(tasks);

    expect(byTag).to.be.instanceOf(Array);

    console.log(JSON.stringify(byTag[0], null, 2));

  });

  it('should parse pins', async function () {

    const text = 'a Dubious Ruins lvl.53 d Tower lvl.30 a General Master';

    const tasks = ali.targetsFromText(text);

    console.log(tasks);
    expect(tasks.length).to.be.equal(3);

    const pins = await ali.findByTasks(tasks);

    console.log(pins);

  });

});
