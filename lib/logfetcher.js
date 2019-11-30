const chalk = require('chalk')
const request = require('request-promise-native');
const path = require('path');
const fs = require('fs');
const { timeout, TimeoutError } = require('promise-timeout');

const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36";
const timeoutms = 3000;

const { log } = console;

/**
 * @param {{client_id: string, client_secret: string, hostname: string, token: string}} profile
 */
async function authorize(profile) {
  if (profile.token) {
    return profile.token;
  }

  if (profile.client_id && profile.client_secret) {
    log(chalk.yellow(`\nAuthenticating using oauth - client_id ${profile.client_id}\n`));

    try {
      const response = await request.post({
        url: 'https://account.demandware.com/dw/oauth2/access_token?grant_type=client_credentials',
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        auth: {
          user: profile.client_id,
          pass: profile.client_secret
        }
      });

      profile.token = JSON.parse(response).access_token;
      return profile.token;
    } catch (err) {
      log(chalk.red(`Error authenticating using client id ${profile.client_id} - please check your credentials: ${err}.\n`));
      throw err;
    }
  }
  else {
    log(chalk.yellow('\nMissing authentication credentials. Please add client_id/client_secret to dw.json and add required webdav credentials in BM -> Administration -> Organization -> WebDAV Client Permissions.'));
    log(chalk.yellow(`Sample permissions:\n`));
    log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'UTF-8')));
    log('\n');
    process.exit(0);
  }
  return null;
}
/**
 * @param {{client_id: string, client_secret: string, hostname: string, token: string}} profile
 */
async function fetchLogList(profile) {
  await authorize(profile);
  return fetchLogListExecute(profile)
}

/**
 * @param {{client_id: string, client_secret: string, hostname: string, token: string}} profile
 */
async function fetchLogListExecute(profile) {
  try {
    let res = await request.get({
      method: 'GET',
      uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`,
      headers: { 'User-Agent': ua },
      auth: {
        bearer: profile.token
      }
    });
    return res;
  } catch (err) {
    if (err.statusCode === 401) {
      log(chalk.yellow('\nAuthentication successful but access to logs folder has been denied. Please add required webdav permissions in BM -> Administration -> Organization -> WebDAV Client Permissions.'));
      log(chalk.yellow(`Sample permissions:\n`));
      log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'UTF-8')));
      log('\n');
      process.exit(0);
    }
    log('Request failed with error:', err.message);
    throw err;
  }
}

async function fetchFileSize(profile, logobj) {
  await authorize(profile);
  return fetchFileSizeExecute(profile, logobj);
};


async function fetchFileSizeExecute(profile, logobj) {
  if (logobj.debug) {
    log(chalk.cyan(`Fetching size for ${logobj.log}`));
  }

  let opts = {
    headers: {
      'User-Agent': ua
    },
    auth: {
      bearer: profile.token
    },
    uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
  };
  let res = await request.head(opts);
  let size = 0;
  if (res['content-length']) {
    size = parseInt(res['content-length'], 10);
  } else {
    if (logobj.debug) {
      log(chalk.cyan(`No content-length, fetching whole file`));
    }
    res = await request.get(opts);
    size = res.length;
  }
  if (logobj.debug) {
    log(chalk.cyan(`Fetched size for ${logobj.log}: size ${size}`));
  }
  return size;
}

async function fetchLogContent(profile, logobj) {
  await authorize(profile);

  let res = timeout(fetchLogContentExecute(profile, logobj), timeoutms).catch(err2 => {
    if (err2 instanceof TimeoutError) {
      if (logobj.debug){
        console.log(chalk.cyan('** timeout **')); // will retry again
      }
    }
  });
  if (res === '401') {
    log(chalk.magenta('*** refreshing token ***'));
    await authorize(profile);
    res = timeout(fetchLogContentExecute(profile, logobj), timeoutms);
  }

  return res;
}

async function fetchLogContentExecute(profile, logobj) {
  if (logobj.debug) {
    log(`*** ${logobj.log}` );
  }
  try {
    let res = await request.get({
      method: 'GET',
      headers: { 'User-Agent': ua, 'Range': `bytes=${logobj.size}-` },
      auth: {
        bearer: profile.token
      },
      uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
      resolveWithFullResponse: true,
      timeout: 5000, // 5 sec
      simple: false
    });

    if (res.statusCode === 206) {
      logobj.size += res.body.length;
      return res.body;
    }
    if (res.statusCode === 401) {
      return '401';
    }
  } catch (err) {
    console.log(chalk.red(`Error fetching ${logobj.log}: ${err.message}`));
  }
  return '';
}


module.exports = { fetchLogList, fetchFileSize, fetchLogContent }