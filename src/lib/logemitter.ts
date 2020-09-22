import s from 'underscore.string';
import moment from 'moment';
import { LogLine } from './types';
import logger from './logger';

const logemitter = {

  sort: function (logs: LogLine[]): LogLine[] {
    return logs.sort((a, b) => (a.timestamp || moment('1900-01-01')).valueOf() - (b.timestamp || moment('1900-01-01')).valueOf());
  },

  output: function (logs: LogLine[], printnots: boolean, debug: boolean): void {
    if (logs.length === 0) {
      logger.log(logger.debug, '.', debug);
    }

    for (let j = 0; j < logs.length; j++) {
      let log = logs[j];

      if (!printnots && !log.timestamp) {
        // eslint-disable-next-line no-continue
        continue;
      }

      let message = '';
      if (log.timestamp) {
        message = `${log.timestamp.local().format('YYYY-MM-DD HH.mm.ss.SSS ZZ')} `;
      }
      if (log.level) {
        message += `${s.rpad(log.level, 5)} `;
      }

      message += log.message;
      logger.log(log.level, message);
    }
  }
}

export default logemitter;
