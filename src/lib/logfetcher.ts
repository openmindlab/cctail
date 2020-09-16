import Axios, { Method, AxiosResponse, AxiosRequestConfig } from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { DwJson, LogFile } from './types';
import logger from './logger'
import moment from 'moment';

const { log } = console;

const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.97 Safari/537.36";
const timeoutMs = 3000;
const initialBytesRead = 20000;

// Yup, we're single threaded. Thanks SFCC API!
const requestsMaxCount = 1;
const requestIntervalMs = 10;
let requestsPending = 0;

const axios = Axios.create();

// Axios Request Interceptor
axios.interceptors.request.use(function(config) {
  return new Promise((resolve, reject) => {
    let interval = setInterval(() => {
      if (requestsPending < requestsMaxCount) {
        requestsPending++;
        clearInterval(interval);
        resolve(config);
      }
    }, requestIntervalMs);
  })
})

// Axios Response Interceptor
axios.interceptors.response.use(function(response) {
  requestsPending = Math.max(0, requestsPending - 1);
  return Promise.resolve(response);
}, function(error) {
  requestsPending = Math.max(0, requestsPending - 1);
  return Promise.reject(error);
})

const logfetcher = {

  errorcount: 0,
  errorlimit: 5,

  makeRequest: async function(profile: DwJson, methodStr: string, url_suffix: string, headers: Map<string, string>, debug?: boolean): Promise<AxiosResponse> {
    if (!this.isUsingBM(profile) && !this.isUsingAPI(profile)) {
      this.logMissingAuthCredentials();
      process.exit(1);
    }

    let url = `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`;
    let method: Method = (methodStr as Method);
    if (url_suffix && url_suffix.length > 0) {
      url += '/' + url_suffix;
    }

    let opts: AxiosRequestConfig = {
      method: method,
      timeout: timeoutMs,
      url: url,
      headers: {}
    }

    if (this.isUsingBM(profile)) {
      opts.headers.Authorization = 'Basic ' + Buffer.from(profile.username + ':' + profile.password).toString('base64');
    } else {
      if (!profile.token_expiry || moment.utc().isSameOrAfter(profile.token_expiry)) {
        await this.authorize(profile, debug);
      }
      opts.headers.Authorization = profile.token;
    }

    if (headers && headers.size > 0) {
      for (let [key, value] of headers) {
        opts.headers[key] = value;
      }
    }

    return axios.request(opts);
  },

  authorize: async function(profile: DwJson, debug?: boolean): Promise<void> {
    if (!this.isUsingAPI(profile)) {
      this.logMissingAuthCredentials();
      process.exit(1);
    }

    logger.log(logger.debug, `Authenticating to client API using client id ${profile.client_id}`, debug);
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
      profile.token_expiry = moment.utc().add(response.data.expires_in, 's').subtract(profile.polling_interval, 's');
      logger.log(logger.debug, `Authenticated, token expires at ${profile.token_expiry.toString()}`, debug);
    } catch (err) {
      logger.log(logger.error, `Error authenticating client id ${profile.client_id} - please check your credentials.\n${err}.`);
      process.exit(1);
    }
  },

  fetchLogList: async function(profile: DwJson, debug?: boolean): Promise<string> {
    try {
      let headers = new Map([
        ["User-Agent", ua]
      ]);
      let res = await this.makeRequest(profile, 'GET', '', null, debug);
      return res.data;
    } catch (err) {
      if (err.status === 401) {
        logger.log(logger.warn, 'Authentication successful but access to logs folder has been denied.');
        logger.log(logger.warn, 'Please add required webdav permissions in BM -> Administration -> Organization -> WebDAV Client Permissions.');
        logger.log(logger.warn, 'Sample permissions:');
        logger.log(logger.warn, fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8'));
        log('\n');
      } else {
        logger.log(logger.error, 'Request failed with error: ' + err.message);
      }
      process.exit(1);
    }
  },

  fetchFileSize: async function(profile: DwJson, logobj: LogFile): Promise<number> {
    let size = 0;
    try {
      logger.log(logger.debug, chalk.cyan(`Fetching size for ${logobj.log}`), logobj.debug);

      let res = await this.makeRequest(profile, 'HEAD', logobj.log, null);
      if (res.headers['content-length']) {
        size = parseInt(res.headers['content-length'], 10);
      } else {
        logger.log(logger.debug, `No content-length, fetching whole file: ${logobj.log}`, logobj.debug);
        res = await this.makeRequest(profile, 'GET', logobj.log, null);
        size = res.data.length;
      }
      logger.log(logger.debug, `Fetched size for ${logobj.log}: size ${size}`, logobj.debug);
    } catch (err) {
      logger.log(logger.error, `Fetching file size of ${logobj.log} failed with error: ${err.message}`);
    }
    return size;
  },

  fetchLogContent: async function(profile: DwJson, logobj: LogFile): Promise<[string, string]> {
    if (logobj.rolled_over) {
      logobj.size = 0;
      logobj.rolled_over = false;
    } else if (!logobj.size) {
      let size = await this.fetchFileSize(profile, logobj);
      logobj.size = Math.max(size - initialBytesRead, 0);
    }

    let headers = new Map([
      ["Range", `bytes=${logobj.size}-`]
    ]);

    try {
      logger.log(logger.debug, `Fetching log content from ${logobj.log}`, logobj.debug);
      let res = await this.makeRequest(profile, 'GET', logobj.log, headers);
      logger.log(logger.debug, `${logobj.log} - status code ${res.status}`, logobj.debug);

      if (res.status === 206) {
        logobj.size += res.data.length;
        return [logobj.log, res.data];
      }
    } catch (err) {
      if (err.response) {
        logger.log(logger.debug, `${logobj.log} - status code ${err.response.status}`, logobj.debug);
      }
      if (!err.response || err.response.status !== 416) {
        this.errorcount = this.errorcount + 1;
        logger.log(logger.error, `Error fetching ${logobj.log}: ${err.message} (error count ${this.errorcount})`);
        if (this.isUsingAPI(profile) && this.errorcount > this.errorlimit) {
          logger.log(logger.error, `Error count exceeded ${this.errorlimit}, resetting Client API token.`);
          profile.token = null;
        }
      }
    }
    return ['', ''];
  },

  logMissingAuthCredentials: function() {
    logger.log(logger.error, ('Missing authentication credentials. Please add client_id/client_secret or username/password to log.conf.json or dw.json.'));
    logger.log(logger.error, (`Sample config:\n`));
    logger.log(logger.error, (fs.readFileSync(path.join(__dirname, '../log.config-sample.json'), 'utf8')));
    log('\n');
  },

  isUsingAPI: function(profile: DwJson) {
    return (profile.client_id && profile.client_secret)
  },

  isUsingBM: function(profile: DwJson) {
    return (profile.username && profile.password)
  }
}

export default logfetcher;
