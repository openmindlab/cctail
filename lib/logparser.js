const moment = require('moment');

/**
 * @param {Array.<Promise>} files
 * @returns {Array.<{timestamp: String, level: String, message: String}>}
 */
async function process(files) {
  return Promise.all(files).then((values) => {
    return values.map((data) => parseLog(data)).reduce((a, b) => a.concat(b));
  });
}

/**
 * @param {String} data
 * @returns {Array.<{timestamp: Object, level: String, message: String}>}
 */
function parseLog(data) {
  let linesobj = [];
  let regexp = new RegExp((/\[([.0-9 .:-]* GMT)\] (DEBUG|INFO|WARN|ERROR|FATAL)? ?(.*)/g));
  regexp.lastIndex = 0;
  let lastmatchend = 0;
  let mmatch;
  // eslint-disable-next-line no-cond-assign
  while (mmatch = regexp.exec(data)) {
    let start = mmatch.index;
    let end = start + mmatch[0].length;
    if (start > 0 && linesobj.length === 0) {
      linesobj.push({
        message: data.substring(0, start - 1)
      });
    }
    else if (start > (lastmatchend + 1)) {
      // append extra lines to the previous log
      linesobj[linesobj.length - 1].message += `${data.substring(lastmatchend, start - 1)}`;
    }
    // 2019-07-15 11:00:07.235 GMT
    let timestamp = moment(mmatch[1], "YYYY-MM-DD HH:mm:ss.SSS zz");
    let level = mmatch[2] || 'INFO';
    let message = mmatch[3];
    lastmatchend = end;
    linesobj.push({ timestamp, level, message });
  }
  if (linesobj.length > 0 && lastmatchend < data.length) {
    linesobj[linesobj.length - 1].message += `${data.substring(lastmatchend, data.length)}`;
  }
  if (lastmatchend === 0 && data && data.length > 0) { // no match
    linesobj.push({
      message: data
    });
  }
  return linesobj;
}

module.exports = { process, parseLog }