import { blue, blueBright, cyan, cyanBright, green, greenBright, magenta, magentaBright, red, redBright, yellow, yellowBright } from 'colorette';
const { log } = console;

const logger = {

  debugPrefix: '*** ',

  debug: 'debug',
  error: 'error',
  fatal: 'fatal',
  info: 'info',
  jobs: 'jobs',
  profile: 'PROFILE',
  warn: 'warn',

  colormap: {
    DEBUG: cyanBright,
    debug: cyan,
    ERROR: redBright,
    error: red,
    FATAL: redBright,
    fatal: red,
    INFO: greenBright,
    info: green,
    JOBS: blueBright,
    jobs: blue,
    PROFILE: magentaBright,
    profile: magenta,
    WARN: yellowBright,
    warn: yellow
  },

  log: function (level: string, text: string, debug?: boolean) {
    if (level !== this.debug) {
      log(this.colorize(level, text));
    } else if (debug) {
      log(this.colorize(level, this.debugPrefix + text));
    }
  },

  colorize: function (level: string, text: string) {
    if (!level || level.length === 0) {
      return text;
    }

    let color = this.colormap[level];
    if (!color) {
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
        case this.checkFor(level, "profile"):
          color = this.colormap["profile"];
          break;
        default:
          break;
      }
    }

    if (color) {
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
