const table = db.Duel;
const cursor = table.find({});

let ops = [];
let page = 0;

while (cursor.hasNext()) {

  const { _id, winner, loser, players: hasPlayers } = cursor.next();

  if (hasPlayers) {
    continue;
  }

  const players = [
    { name: winner.name, id: winner.id, tag: winner.tag },
    { name: loser.name, id: loser.id, tag: loser.tag },
  ];

  ops.push({
    updateOne: {
      filter: { _id },
      update: { $set: { players } },
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
