import chalk from 'chalk';
const { log } = console;

const logger = {

  debugPrefix: '*** ',

  debug: 'debug',
  error: 'error',
  fatal: 'fatal',
  info: 'info',
  jobs: 'jobs',
  warn: 'warn',

  colormap: {
    DEBUG: chalk.cyanBright,
    debug: chalk.cyan,
    ERROR: chalk.redBright,
    error: chalk.red,
    FATAL: chalk.redBright,
    fatal: chalk.red,
    INFO: chalk.greenBright,
    info: chalk.green,
    JOBS: chalk.blueBright,
    jobs: chalk.blue,
    WARN: chalk.yellowBright,
    warn: chalk.yellow
  },

  log: function (level: string, text: string, debug?: boolean) {
    if(level !== this.debug) {
      log(this.colorize(level, text));
    } else if (debug) {
      log(this.colorize(level, this.debugPrefix + text));
    }
  },

  colorize: function (level: string, text: string) {
    if(!level || level.length === 0) {
      return text;
    }

    let color = this.colormap[level];
    if(!color) {
      switch (true) {
        case this.checkFor(level, "info"):
          color = this.colormap["info"];
          break;
        case this.checkFor(level, "warn"):
          color = this.colormap["warn"];
          break;
        case this.checkFor(level, "error"):
          color = this.colormap["error"];
          break;
        case this.checkFor(level, "fatal"):
          color = this.colormap["fatal"];
          break;
        case this.checkFor(level, "jobs"):
          color = this.colormap["jobs"];
          break;
        case this.checkFor(level, "debug"):
          color = this.colormap["debug"];
          break;
        default:
          break;
      }
    }

    if(color) {
      return color(text);
    } else {
      return text;
    }
  },

  checkFor: function (input: string, term: string) {
    return (input.indexOf(term) != -1);
  }
}

export default logger
