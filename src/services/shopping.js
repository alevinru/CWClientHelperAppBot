import lo from 'lodash';
import Shop from '../models/Shop';
import log from './log';

const { debug } = log('shopping');

export async function gurus(level) {

  const qualityCraftLevel = level || { $gt: 0 };

  const qualityShops = await Shop.aggregate([
    { $match: { qualityCraftLevel } },
    { $sort: { qualityCraftLevel: 1 } },
  ]);

  const lastDigest = await lastDigestOpened();

  debug('gurus', lastDigest.toISOString());

  const withGuru = lo.filter(lo.map(qualityShops, shop => ({
    ...shop,
    guruOf: mainSpecialization(shop),
    isOpen: lastDigest.toISOString() <= shop.lastOpened.toISOString(),
  })), 'guruOf');

  const topQualityLevels = lo.mapValues(lo.keyBy(withGuru, 'guruOf'), 'qualityCraftLevel');

  const topGurus = lo.filter(withGuru, ({ qualityCraftLevel: qc, guruOf }) => {
    return qc === topQualityLevels[guruOf];
  });

  const byGuruOf = lo.groupBy(topGurus, 'guruOf');

  // debug('gurus', byGuruOf);

  return lo.map(byGuruOf, (shops, guruOf) => ({
    specialization: guruOf,
    level: topQualityLevels[guruOf],
    shops,
  }));

}


export function mainSpecialization({ specialization }) {

  const [guru] = lo.filter(lo.map(specialization, (level, type) => level === 100 && type));

  return guru;

}

export async function lastDigestOpened() {
  const last = await Shop.findOne().sort({ lastOpened: -1 });
  return last ? last.lastOpened : null;
}

export function specializationTitle(specialization) {

  if (specialization === 'shield') {
    return 'Shield and Dagger';
  }

  return lo.upperFirst(specialization);

}
