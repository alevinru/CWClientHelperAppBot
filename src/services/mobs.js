import lo from 'lodash';
// import log from './log';

// const { debug } = log('mobs');

const MOBS_HEADERS = [
  'You met some hostile creatures. Be careful:',
  'Ты заметил враждебных существ. Будь осторожен:',
];

const MOBS_RE = RegExp(`(${MOBS_HEADERS.join('|')})\\n`);
const MOBS_MODIFIERS = /[ ][ ]╰ (.+)/;


export function mobsFromText(text) {

  const [, mobHeader] = text.match(MOBS_RE) || [];


  if (!mobHeader) {
    // debug('mobsFromText: no mobs');
    return false;
  }

  const mobsArray = text.replace(mobHeader, '').split('\n');

  const mobs = mobsArray.map((mobText, idx) => {

    const [, name, lvl] = mobText.match(/([a-z ]*) lvl\.(\d+)/i) || [];

    if (!name) {
      return false;
    }

    const mob = { name, level: parseInt(lvl, 0) };
    const nextLine = mobsArray[idx + 1];

    if (nextLine) {
      const [, modifiersText] = nextLine.match(MOBS_MODIFIERS) || [];
      const modifiers = lo.split(modifiersText, ', ');
      if (modifiers) {
        mob.modifiers = modifiers;
      }
    }

    return mob;

  });

  return lo.filter(mobs);

}
