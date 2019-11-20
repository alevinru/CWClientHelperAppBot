import fs from 'fs';
import util from 'util';

export const readFile = util.promisify(fs.readFile);
export const writeFile = util.promisify(fs.writeFile);

export async function readJsonFile(file) {
  const data = await readFile(file);
  return JSON.parse(data);
}
