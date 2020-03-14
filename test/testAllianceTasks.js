import { expect, assert } from 'chai';
import { readFile } from '../src/services/fs';
import * as ali from '../src/services/aliancing';

describe('Battle tasks parser', function () {

  it('should parse text', async function () {

    const text = await readFile('static/allianceTasks.txt');

    const tasks = ali.parseAllianceTask(text.toString());

    expect(tasks).to.be.instanceOf(Array);
    expect(tasks.length).to.equal(58);

    const byTag = ali.allianceTasksByTag(tasks);

    expect(byTag).to.be.instanceOf(Array);

    console.log(JSON.stringify(byTag[0], null, 2));

  });

});
