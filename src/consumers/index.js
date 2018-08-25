import EXConsumer from './exConsumer';
import AUConsumer from './auConsumer';
import DealsConsumer from './dealsConsumer';

/**
 *
 * This module should be run as a separate process
 *
 */

export const ex = new EXConsumer();
export const au = new AUConsumer();
export const deals = new DealsConsumer();
