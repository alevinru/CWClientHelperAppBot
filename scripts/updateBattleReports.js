const table = db.BattleReport;
const cursor = table.find({});

let ops = [];
let page = 0;

const NAME_RE = /(.+) ⚔:(.+) 🛡:(.+) Lvl: (\d+)/;

while (cursor.hasNext()) {

  const { _id, name, tag, results } = cursor.next();

  if (!tag) {
    continue;
  }

  if (!results || !results.length) {
    print('No results', _id);
    continue;
  }

  const matched = results[0].match(NAME_RE);

  if (!matched) {
    print('No match', _id);
    continue;
  }

  const [, resultName] = results[0].match(NAME_RE);

  const updatedName = resultName.replace(/^[^[]+/, '').replace(/🎗/, '');

  if (updatedName === name) {
    continue;
  }

  ops.push({
    updateOne: {
      filter: { _id },
      update: { $set: { name: updatedName } },
    },
  });

  if (ops.length === 500) {
    table.bulkWrite(ops);
    ops = [];
    page += 1;
    printjson(page);
  }

}

if (ops.length) {
  table.bulkWrite(ops);
  printjson(page);
}
