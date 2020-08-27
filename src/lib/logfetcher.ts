import Axios, { AxiosRequestConfig } from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { DwJson, LogFile } from './types';
const { timeout, TimeoutError } = require('promise-timeout');

const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36";
const timeoutms = 3000;

const { log } = console;

const axios = Axios.create();
axios.defaults.validateStatus = function () {
  return true;
};

const logfetcher = {

  errorcount: 0,

  authorize: async function (profile: DwJson): Promise<string> {
    if (profile.token) {
      return profile.token;
    }

    if (profile.client_id && profile.client_secret) {
      log(chalk.yellow(`\nAuthenticating using oauth - client_id ${profile.client_id}\n`));

      try {
        const response = await axios.request({
          url: 'https://account.demandware.com/dw/oauth2/access_token?grant_type=client_credentials',
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: profile.client_id,
            password: profile.client_secret
          }
        });

        profile.token = response.data.access_token;
        return profile.token;
      } catch (err) {
        log(chalk.red(`Error authenticating using client id ${profile.client_id} - please check your credentials: ${err}.\n`));
        throw err;
      }
    }
    else {
      log(chalk.yellow('\nMissing authentication credentials. Please add client_id/client_secret to dw.json and add required webdav credentials in BM -> Administration -> Organization -> WebDAV Client Permissions.'));
      log(chalk.yellow(`Sample permissions:\n`));
      log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8')));
      log('\n');
      process.exit(0);
    }
    return null;
  },

  fetchLogList: async function (profile: DwJson): Promise<string> {
    await this.authorize(profile);
    return this.fetchLogListExecute(profile)
  },

  fetchLogListExecute: async function (profile: DwJson): Promise<string> {
    try {
      let res = await axios.request({
        method: 'GET',
        url: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`,
        headers: {
          'User-Agent': ua,
          Authorization: `Bearer ${profile.token}`
        }
      });
      return res.data;
    } catch (err) {
      if (err.statusCode === 401) {
        log(chalk.yellow('\nAuthentication successful but access to logs folder has been denied. Please add required webdav permissions in BM -> Administration -> Organization -> WebDAV Client Permissions.'));
        log(chalk.yellow(`Sample permissions:\n`));
        log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8')));
        log('\n');
        process.exit(0);
      }
      log('Request failed with error:', err.message);
      throw err;
    }
  },

  fetchFileSize: async function (profile: DwJson, logobj: LogFile): Promise<number> {
    await this.authorize(profile);
    return this.fetchFileSizeExecute(profile, logobj);
  },


  fetchFileSizeExecute: async function (profile: DwJson, logobj: LogFile): Promise<number> {
    if (logobj.debug) {
      log(chalk.cyan(`Fetching size for ${logobj.log}`));
    }

    let opts: AxiosRequestConfig = {
      method: 'HEAD',
      headers: {
        'User-Agent': ua,
        Authorization: `Bearer ${profile.token}`
      },
      url: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
    };
    let res = await axios.request(opts);
    let size = 0;
    if (res.headers['content-length']) {
      size = parseInt(res.headers['content-length'], 10);
    } else {
      if (logobj.debug) {
        log(chalk.cyan(`No content-length, fetching whole file`));
      }
      opts.method = 'GET';
      res = await axios.request(opts);
      size = res.data.length;
    }
    if (logobj.debug) {
      log(chalk.cyan(`Fetched size for ${logobj.log}: size ${size}`));
    }
    return size;
  },

  fetchLogContent: async function (profile: DwJson, logobj: LogFile): Promise<string> {
    await this.authorize(profile);

    let res = timeout(this.fetchLogContentExecute(profile, logobj), timeoutms)
      .catch((err2: Error) => {
        if (err2 instanceof TimeoutError) {
          if (logobj.debug) {
            console.log(chalk.cyan('** timeout **')); // will retry again
          }
        }
      });
    if (res === '401') {
      log(chalk.magenta('*** refreshing token ***'));
      await this.authorize(profile);
      res = timeout(this.fetchLogContentExecute(profile, logobj), timeoutms);
    }

    return res;
  },

  fetchLogContentExecute: async function (profile: DwJson, logobj: LogFile): Promise<string> {
    if (logobj.debug) {
      log(`*** ${logobj.log}`);
    }

    let request: AxiosRequestConfig = {
      method: 'GET',
      headers: {
        'User-Agent': ua,
        'Range': `bytes=${logobj.size}-`,
        Authorization: `Bearer ${profile.token}`
      },
      url: `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs/${logobj.log}`,
      timeout: 5000 // 5 sec
    };

    try {
      let res = await axios.request(request);

      if (res.status === 206) {
        logobj.size += res.data.length;
        return res.data;
      }
      if (res.status === 401) {
        return '401';
      }
      if (res.status === 416) {
        // no data after range
        return '';
      }
      if (logobj.debug) {
        log(`*** ${logobj.log} status code ${res.status}`);
      }
    } catch (err) {
      // read ECONNRESET
      // timeout of 5000ms exceeded
      // connect ETIMEDOUT x.x.x.x:443
      // getaddrinfo ENOTFOUND xxxx
      this.errorcount = this.errorcount + 1;
      console.log(chalk.red(`Error fetching ${logobj.log}: ${err.message} (error count ${this.errorcount})`));
      if (this.errorcount > 5) {
        this.errorcount = 0;
        profile.token = null;
        this.authorize(profile);
      }
    }
    return '';
  }
}

export default logfetcher;