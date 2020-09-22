import { LogLine, FluentConfig } from './types';
import logger from './logger';
const fluent = require('fluent-logger');

class LogFluent implements FluentConfig {
  enabled: boolean;
  host: string;
  port: number;
  reconnect_interval: number;
  timeout: number;
  tag_prefix: string;

  constructor(fConfig: FluentConfig) {
    this.enabled = fConfig.enabled;
    this.host = fConfig.host || 'localhost';
    this.port = fConfig.port || 24224;
    this.reconnect_interval = fConfig.reconnect_interval || 600;
    this.timeout = fConfig.timeout || 3.0;
    this.tag_prefix = fConfig.tag_prefix || 'sfcc';

    fluent.configure(this.tag_prefix, {
      host: this.host,
      port: this.port,
      timeout: this.timeout,
      reconnectInterval: this.reconnect_interval * 1000
    });
  }

  output(hostname: string, logs: LogLine[], printnots: boolean, debug: boolean) {
    logger.log(logger.debug, `Sending ${logs.length} new log records to FluentD this interval.`, debug);

    for (let j = 0; j < logs.length; j++) {
      let log = logs[j];

      if (!printnots && !log.timestamp) {
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        fluent.emit(log.logfile.substr(0, log.logfile.indexOf('-')), {
          logfile: log.logfile,
          level: log.level,
          message: log.message.trim(),
          hostname: hostname
        }, fluent.EventTime.fromTimestamp(log.timestamp.valueOf()));
      } catch (err) {
        logger.log('error', 'Send to FluentD failed with error: ' + err);
      }
    }
  }
}

export default LogFluent;
