import Axios, { Method, AxiosResponse, AxiosRequestConfig } from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { DwJson, LogFile } from './types';
import moment from 'moment';

const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36";
const timeoutMs = 3000;

const { log } = console;

const axios = Axios.create();
/* axios.defaults.validateStatus = function () {
  return true;
}; */

const logfetcher = {

  errorcount: 0,
  errorlimit: 5,

  makeRequest: async function(profile: DwJson, methodStr: string, url_suffix: string, headers: Map<string, string>): Promise<AxiosResponse> {
    let url = `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`;
    let method: Method = (methodStr as Method);
    if (url_suffix && url_suffix.length > 0) {
      url += '/' + url_suffix;
    }

    let opts: AxiosRequestConfig = {
      method: method,
      headers: {
        'User-Agent': ua
      },
      timeout: timeoutMs,
      url: url
    }

    if (headers && headers.size > 0) {
      for (let [key, value] of headers) {
        opts.headers[key] = value;
      }
    }

    if (profile.auth_type === 'bm') {
      opts.headers.Authorization = 'Basic ' + Buffer.from(profile.client_id + ':' + profile.client_secret).toString('base64');
    } else {
      if (!profile.token_expiry || moment().isSameOrAfter(profile.token_expiry)) {
        await this.authorize(profile);
      }
      opts.headers.Authorization = profile.token;
    }

    return axios.request(opts);
  },

  authorize: async function(profile: DwJson): Promise<void> {
    if (profile.client_id && profile.client_secret) {
      log(chalk.yellow(`\nAuthenticating using oauth - client_id ${profile.client_id}\n`));
      try {
        const response = await axios.request({
          url: 'https://account.demandware.com/dw/oauth2/access_token?grant_type=client_credentials',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          auth: {
            username: profile.client_id,
            password: profile.client_secret
          }
        });
        profile.token = response.data.token_type.trim() + ' ' + response.data.access_token.trim();
        profile.token_expiry = moment().add(response.data.expires_in, 's').subtract(profile.pollingInterval, 's');
      } catch (err) {
        log(chalk.red(`Error authenticating using client id ${profile.client_id} - please check your credentials: ${err}.\n`));
        process.exit(1);
      }
    } else {
      log(chalk.red('\nMissing authentication credentials. Please add client_id/client_secret to log.conf.json or dw.json.'));
      log(chalk.red(`Sample permissions:\n`));
      log(chalk.red(fs.readFileSync(path.join(__dirname, '../log.config-sample.json'), 'utf8')));
      log('\n');
      process.exit(1);
    }
  },

  fetchLogList: async function(profile: DwJson): Promise<string> {
    try {
      let res = await this.makeRequest(profile, 'GET', '', null);
      return res.data;
    } catch (err) {
      if (err.status === 401) {
        log(chalk.yellow('\nAuthentication successful but access to logs folder has been denied.\n'));
        log(chalk.yellow('Please add required webdav permissions in BM -> Administration -> Organization -> WebDAV Client Permissions.\n'));
        log(chalk.yellow('Sample permissions:\n'));
        log(chalk.yellow(fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8')));
        log('\n');
      } else {
        log(chalk.red('Request failed with error: ' + err.message));
      }
      process.exit(1);
    }
  },

  fetchFileSize: async function(profile: DwJson, logobj: LogFile): Promise<number> {
    let size = 0;
    try {
      if (logobj.debug) {
        log(chalk.cyan(`Fetching size for ${logobj.log}`));
      }
      let res = await this.makeRequest(profile, 'HEAD', logobj.log, null);
      let size = 0;
      if (res.headers['content-length']) {
        size = parseInt(res.headers['content-length'], 10);
      } else {
        if (logobj.debug) {
          log(chalk.cyan(`No content-length, fetching whole file`));
        }
        res = await this.makeRequest(profile, 'GET', logobj.log, null);
        size = res.data.length;
      }
      if (logobj.debug) {
        log(chalk.cyan(`Fetched size for ${logobj.log}: size ${size}`));
      }
    } catch (err) {
      log(chalk.red(`Fetching file size of ${logobj.log} failed with error: ${err.message}`));
    }
    return size;
  },

  fetchLogContent: async function(profile: DwJson, logobj: LogFile): Promise<[string, string]> {
    if (logobj.debug) {
      log(`*** ${logobj.log}`);
    }
    let headers = new Map([
      ["Range", `bytes=${logobj.size}-`]
    ]);

    try {
      let res = await this.makeRequest(profile, 'GET', logobj.log, headers);

      if (logobj.debug) {
        log(`*** ${logobj.log} status code ${res.status}`);
      }
      if (res.status === 206) {
        logobj.size += res.data.length;
        return [logobj.log, res.data];
      }
    } catch (err) {
      if (logobj.debug && err.response) {
        log(`*** ${logobj.log} status code ${err.response.status}`);
      }
      if (!err.response || err.response.status !== 416) {
        this.errorcount = this.errorcount + 1;
        console.log(chalk.red(`Error fetching ${logobj.log}: ${err.message} (error count ${this.errorcount})`));
        if (profile.auth_type !== 'bm' && this.errorcount > this.errorlimit) {
          console.log(chalk.red(`Error count exceeded ${this.errorlimit}, resetting OAuth token.`));
          profile.token = null;
        }
      }
    }
    return ['', ''];
  }
}

export default logfetcher;
