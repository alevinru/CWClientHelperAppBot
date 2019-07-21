const table = db.BattleReport;
const cursor = table.find({});

let ops = [];
let page = 0;

while (cursor.hasNext()) {

  const { _id, tag, name } = cursor.next();

  if (tag) {
    continue;
  }

  const [, guildTag = null] = name.match(/\[(.+)\]/) || [];

  ops.push({
    updateOne: {
      filter: { _id },
      update: { $set: { tag: guildTag } },
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
