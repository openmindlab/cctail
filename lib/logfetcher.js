const chalk = require('chalk')
const auth = require('sfcc-ci').auth
const request = require('request-promise-native');
const path = require('path');
const fs = require('fs');

const ua = "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/536.11 (KHTML, like Gecko) Chrome/20.0.1132.57 Safari/536.11";

const { log } = console;

async function authorize(profile, options) {
  if (profile.token) {
    options.headers.Authorization = ` Bearer ${profile.token}`;
  }
  else if (profile.client_id && profile.client_secret) {
    log(chalk.yellow(`\nAuthenticating using oauth - client_id ${profile.client_id}\n`));
    profile.token = await new Promise((resolve, reject) => {
      auth.auth(profile.client_id, profile.client_secret, (err, token) => {
        if (err) {
          // log('ERR:', err);
          log(chalk.red(`Error authenticating using client id ${profile.client_id} - please check your credentials.\n`));
          process.exit(0);
        }
        resolve(token);
      });
    }).catch((err) => {
      log(chalk.red(`Error authenticating using client id ${profile.client_id}: ${err}`));
      process.exit(0);
    });
    options.headers.Authorization = ` Bearer ${profile.token}`;
  }
  else {
    log(chalk.yellow('\nMissing authentication credentials. Please add client_id/client_secret to dw.json and add required webdav credentials in BM -> Administration -> Organization -> WebDAV Client Permissions.'));
    log(chalk.yellow(`Sample permissions:\n`));
    log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'UTF-8')));
    log('\n');
    process.exit(0);
  }
  return options;
}

async function fetchLogList(profile) {
  let options = await authorize(profile, {
    method: 'GET',
    uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`,
    headers: { 'User-Agent': ua },
  });

  try {
    let res = await request.get(options);
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
    process.exit(0);
  }
}

async function fetchFileSize(profile, logobj) {
  let options = await authorize(profile, {
    method: 'HEAD',
    headers: { 'User-Agent': ua },
    uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
  });

  let res = await request.head(options);
  return parseInt(res['content-length'], 10);
};


async function fetchLogContent(profile, logobj) {
  let options = await authorize(profile, {
    method: 'GET',
    headers: { 'User-Agent': ua, 'Range': `bytes=${logobj.size}-` },
    uri: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
    resolveWithFullResponse: true,
    simple: false
  });

  let res = await request.get(options);
  let diffsize = parseInt(res.headers['content-length'], 10);
  if (res.statusCode === 206) {
    logobj.size += diffsize;
    return res.body;
  }
  return '';
}


module.exports = { fetchLogList, fetchFileSize, fetchLogContent }