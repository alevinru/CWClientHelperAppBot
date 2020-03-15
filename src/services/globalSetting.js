// import lo from 'lodash';
import GlobalSetting from '../models/GlobalSetting';
import log from './log';

const { debug, error } = log('GlobalSettingHelper');

class GlobalSettingHelper {

  constructor() {
    this.settingsMap = new Map();
    this.initWatch();
    this.initCache()
      .catch(error);
  }

  getValue(code) {
    return this.settingsMap.get(code);
  }

  updateMap(settings) {
    this.settingsMap = new Map(settings.map(s => {
      // debug('updateMap', s.toObject());
      return [s.code, s.value];
    }));
  }

  async initCache() {
    const settings = await GlobalSetting.find();
    this.updateMap(settings);
    debug('init', settings);
  }

  initWatch() {
    GlobalSetting.watch()
      .on('change', () => {
        this.initCache()
          .catch(error);
      });
  }

}

export default new GlobalSettingHelper();
