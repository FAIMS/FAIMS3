export default function getLocalDate(value: Date) {
  /**
   * Return local time in yyyy-MM-ddTHH:mm:ss format by converting to
   * ISO (which only returns UTC), shifting to your local TZ,
   * and chopping off the Z
   *
   * Add the timezone offset and convert to an ISO date,
   * then strip the timezone with the substring(0, 16)
   */
  // getTimezoneOffset returns your local timezone offset in minutes

  const offset = value.getTimezoneOffset() * 1000 * 60; // convert to ms
  const offsetDate = new Date(value).valueOf() - offset; // (valueOf returns milliseconds)
  const date = new Date(offsetDate).toISOString();
  return date.substring(0, 19);

  // the equivalent with moment.js
  // return moment(value).utcOffset(0, true).format('YYYY-MM-DDTHH:mm:ss');
}
