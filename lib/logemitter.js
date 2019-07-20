const chalk = require('chalk');
const s = require('underscore.string');
const moment = require('moment');

const colormap = {
  WARN: 'yellow',
  ERROR: 'red',
  FATAL: 'red',
  INFO: 'green',
  DEBUG: 'cyan'
}


/**
 * @param {Array.<{timestamp: Object, level: String, message: String}>} logs
 * @return {Array.<{timestamp: Object, level: String, message: String}>}
 */
function sort(logs) {
  return logs.sort((a, b) => (a.timestamp || moment('1900-01-01')).unix() - (b.timestamp || moment('1900-01-01')).unix());
}

/**
 * @param {Array.<{timestamp: Object, level: String, message: String}>} logs
 * @param {boolean} printnots
 */
function output(logs, printnots) {
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
    let color = colormap[log.level];
    if (color) {
      console.log(chalk.keyword(color)(message));
    } else {
      console.log(message);
    }
  }
}

module.exports = { output, sort }