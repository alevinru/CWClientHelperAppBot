const table = db.BattleReport;
const cursor = table.find({});

let ops = [];
let page = 0;

while (cursor.hasNext()) {

  const { _id, results, gold } = cursor.next();

  if (gold !== 0) {
    continue;
  }

  const result = results.join('\n');
  const [, updatedGold] = result.match(/Gold: ([-]?\d+)/) || [];

  if (!updatedGold) {
    continue;
  }

  ops.push({
    updateOne: {
      filter: { _id },
      update: { $set: { gold: updatedGold } },
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
