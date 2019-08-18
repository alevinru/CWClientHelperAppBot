import lo from 'lodash';
import { fromCWFilter } from '../config/filters';

export async function onMobForward(ctx) {


  const { state, message, from: { id: userId } } = ctx;
  const { text, forward_date: forwardDate } = message;

  if (!text || !fromCWFilter(ctx)) {
    return false;
  }


}
