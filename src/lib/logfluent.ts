import moment from 'moment';
import { LogLine, FluentConfig } from './types';
const fluent = require('fluent-logger');

class LogFluent implements FluentConfig {
  enabled: boolean;
  host: string;
  port: number;
  reconnectInterval: number;
  timeout: number;
  tagPrefix: string;

  constructor(fConfig: FluentConfig) {
    this.enabled = fConfig.enabled;
    this.host = fConfig.host || 'localhost';
    this.port = fConfig.port || 24224;
    this.reconnectInterval = fConfig.reconnectInterval || 600000;
    this.timeout = fConfig.timeout || 3.0;
    this.tagPrefix = fConfig.tagPrefix || 'sfcc';

    fluent.configure(this.tagPrefix, {
      host: this.host,
      port: this.port,
      timeout: this.timeout,
      reconnectInterval: this.reconnectInterval
    });
  }

  output(hostname: string, logs: LogLine[], printnots: boolean, debug: boolean) {
    if (debug) {
      console.log(`*** Sending ${logs.length} new log records to FluentD this interval.`);
    }
    for (let j = 0; j < logs.length; j++) {
      let log = logs[j];

      if (!printnots && !log.timestamp) {
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        fluent.emit('logs', {
          logfile: log.logfile,
          level: log.level,
          message: log.message,
          hostname: hostname
        }, fluent.EventTime.fromTimestamp(log.timestamp.valueOf()));
      } catch (err) {
        console.log('Send to FluentD failed with error: ' + err);
      }
    }
  }
}

export default LogFluent;
