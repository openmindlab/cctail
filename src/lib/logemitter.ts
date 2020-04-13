import chalk from 'chalk';
import s from 'underscore.string';
import moment from 'moment';

const colormap = {
  WARN: chalk.yellowBright,
  ERROR: chalk.redBright,
  FATAL: chalk.redBright,
  INFO: chalk.greenBright,
  DEBUG: chalk.cyan
}

const logemitter = {

  /**
 * @param {Array.<{timestamp: Object, level: String, message: String}>} logs
 * @return {Array.<{timestamp: Object, level: String, message: String}>}
 */
  sort: function (logs) {
    return logs.sort((a, b) => (a.timestamp || moment('1900-01-01')).valueOf() - (b.timestamp || moment('1900-01-01')).valueOf());
  },

  /**
   * @param {Array.<{timestamp: Object, level: String, message: String}>} logs
   * @param {boolean} printnots
   */
  output: function (logs, printnots, debug) {
    if (logs.length === 0 && debug) {
      console.log('.');
    }
    for (let j = 0; j < logs.length; j++) {
      let log = logs[j];

      if (!printnots && !log.timestamp) {
        // eslint-disable-next-line no-continue
        continue;
      }

      let message = '';
      if (log.timestamp) {
        message = `${log.timestamp.format('YYYY-MM-DD HH.mm.ss.SSS')} `;
      }
      if (log.level) {
        message += `${s.rpad(log.level, 5)} `;
      }
      message += log.message;
      let color = this.colormap[log.level];
      if (color) {
        console.log(color(message));
      } else {
        console.log(message);
      }
    }
  }
}

export default logemitter;