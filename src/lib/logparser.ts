import moment from 'moment';
import { LogFile, LogLine } from './types';
import logger from './logger'

const logparser = {
  process: async function (files: Promise<[LogFile, string]>[]): Promise<LogLine[]> {
    return Promise.all(files).then((values) => {
      return values.map((data) => {
        if(data[0].log.endsWith(".csv"))
          return this.parseCsv(data);
        else
          return this.parseLog(data);
      }).reduce((a, b) => {
        if (a.length === 0)
          return b;
        return a.concat(b);
      });
    });
  },

  parseCsv: function (logdata: [LogFile, string]): LogLine[] {
    let logfile = logdata[0].log.replace("/", "-");
    let timestamp = logdata[0].date;
    let data = logdata[1];
    let linesobj: LogLine[] = [];
    let regexp = new RegExp((/([^\n]+)/g));
    let mmatch;

    while (mmatch = regexp.exec(data)) {
      let start = mmatch.index;
      let end = start + mmatch[0].length;
      // Start > 0 guarantees we skip the first line, which is the CSV header.
      if (start > 0 && end > 0) {
        linesobj.push({
          message: data.substring(start, end),
          timestamp: timestamp,
          level: logger.profile,
          logfile: logfile
        });
      }
    }
    return linesobj;
  },

  parseLog: function (logdata: [LogFile, string]): LogLine[] {
    let logfile = logdata[0].log;
    let data = logdata[1];
    let linesobj: LogLine[] = [];
    let regexp = new RegExp((/\[([.0-9 .:-]*) GMT\] (DEBUG|INFO|WARN|ERROR|FATAL)? ?(.*)/g));
    regexp.lastIndex = 0;
    let lastmatchend = 0;
    let mmatch;
    // eslint-disable-next-line no-cond-assign
    while (mmatch = regexp.exec(data)) {
      let start = mmatch.index;
      let end = start + mmatch[0].length;
      if (start > 0 && linesobj.length === 0) {
        linesobj.push({
          message: data.substring(0, start - 1),
          timestamp: undefined,
          level: undefined,
          logfile: logfile
        });
      }
      else if (start > (lastmatchend + 1)) {
        // append extra lines to the previous log
        linesobj[linesobj.length - 1].message += `${data.substring(lastmatchend, start - 1)}`;
      }
      // 2019-07-15 11:00:07.235
      let timestamp = moment.utc(mmatch[1], "YYYY-MM-DD HH:mm:ss.SSS");
      let level = mmatch[2] || 'INFO';
      let message = mmatch[3];
      lastmatchend = end;
      linesobj.push(
        {
          timestamp,
          level,
          message,
          logfile
        }
      );
    }
    if (linesobj.length > 0 && lastmatchend < data.length) {
      linesobj[linesobj.length - 1].message += `${data.substring(lastmatchend, data.length)}`;
    }
    if (lastmatchend === 0 && data && data.length > 0) { // no match
      linesobj.push({
        message: data,
        timestamp: undefined,
        level: undefined,
        logfile: logfile
      });
    }
    return linesobj;
  }
}

export default logparser;
