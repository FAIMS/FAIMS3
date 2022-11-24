import {getLocalDate} from './DateTimeNow';
import {equals} from '../../utils/eqTestSupport';
import moment from 'moment';

test('ISO string loaded ', () => {
  /**
   * Load in ISO string from DB, converted to local time correctly in
   * DateTimeNow field (input:datetime-local)
   */
  const dummyIsoString = '2020-02-13T22:00:35.736Z';
});

test('ISO string returned from picker', () => {
  /**
   * After choosing a value with the input selector,
   * the input element will show the users local time
   * and the input will return the ISO string to the DB
   */
});

test('ISO string returned from NOW', () => {
  /**
   * After clicking the NOW button, the input will show the users local time
   * and the input will return the ISO string to the DB
   */
});
