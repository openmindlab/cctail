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

// Thank you @matthewsuan! https://gist.github.com/matthewsuan/2bdc9e7f459d5b073d58d1ebc0613169
// Axios Request Interceptor
axios.interceptors.request.use(function (config) {
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
axios.interceptors.response.use(function (response) {
	requestsPending = Math.max(0, requestsPending - 1);
	return Promise.resolve(response);
}, function (error) {
	requestsPending = Math.max(0, requestsPending - 1);
	return Promise.reject(error);
})

const logfetcher = {

	errorcount: 0,
	errorlimit: 5,

	makeRequest: async function (profile: DwJson, methodStr: string, url_suffix: string, headers: Map<string, string>, debug?: boolean, securityRequest?: boolean): Promise<AxiosResponse> {
		if (!this.isUsingBM(profile) && !this.isUsingAPI(profile)) {
			this.logMissingAuthCredentials();
			process.exit(1);
		}

		let url = `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Logs`;
		let method: Method = (methodStr as Method);
		if (url_suffix && url_suffix.length > 0) {
			url += '/' + url_suffix;
		}

		if (profile.log_security && securityRequest) {
			url = `https://${profile.hostname}/on/demandware.servlet/webdav/Sites/Securitylogs`;
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
			await this.authorize(profile, debug);
			opts.headers.Authorization = profile.token;
		}

		if (headers && headers.size > 0) {
			for (let [key, value] of headers) {
				opts.headers[key] = value;
			}
		}

		// logger.log(logger.debug, `Request: ${JSON.stringify(opts)}`, debug);
		return axios.request(opts);
	},

	authorize: async function (profile: DwJson, debug?: boolean): Promise<void> {
		if (!this.isUsingAPI(profile)) {
			this.logMissingAuthCredentials();
			process.exit(1);
		}

		if (!profile.token || !profile.token_expiry || moment.utc().isSameOrAfter(profile.token_expiry)) {
			logger.log(logger.debug, `Client API token expired or not set, resetting Client API token.`);
		} else {
			return;
		}

		let opts: AxiosRequestConfig = {
			url: 'https://account.demandware.com/dw/oauth2/access_token?grant_type=client_credentials',
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			auth: {
				username: profile.client_id,
				password: profile.client_secret
			}
		}
		// logger.log(logger.debug, `Request: ${JSON.stringify(opts)}`, debug);

		try {
			logger.log(logger.debug, `Authenticating to client API using client id ${profile.client_id}`, debug);
			const response = await axios.request(opts);
			profile.token = response.data.token_type.trim() + ' ' + response.data.access_token.trim();
			profile.token_expiry = moment.utc().add(response.data.expires_in, 's').subtract(profile.polling_interval, 's');
			logger.log(logger.debug, `Authenticated, token expires at ${profile.token_expiry.toString()}`, debug);
		} catch (err) {
			logger.log(logger.error, `Error authenticating client id ${profile.client_id} - please check your credentials.\n${err}.`);
			process.exit(1);
		}
	},

	fetchLogList: async function (profile: DwJson, debug?: boolean, logpath = ''): Promise<string> {
		try {
			if (!logpath || logpath.length === 0) {
				logger.log(logger.debug, `Fetching log list from ${profile.hostname}`, debug);
			} else {
				logger.log(logger.debug, `Fetching log list from ${profile.hostname}, subdirectory ${logpath}`, debug);
			}
			let headers = new Map([["User-Agent", ua]]);
			let res;
			let securityLog;

			if (profile.log_path && profile.log_path === "all") {
				securityLog = true;
				let resSite = await this.makeRequest(profile, 'GET', logpath, headers, debug);
				let resSecurity = await this.makeRequest(profile, 'GET', logpath, headers, debug, securityLog);
				res = { ...resSite, ...resSecurity };
			}
			if (profile.log_path && profile.log_path === "security") {
				securityLog = true;
				res = await this.makeRequest(profile, 'GET', logpath, headers, debug, securityLog);
			} else {
				res = await this.makeRequest(profile, 'GET', logpath, headers, debug);
			}

			return res.data;
		} catch (err) {
			logger.log(logger.error, 'Fetching log list failed with error: ' + err.message);
			switch (err.status) {
				case 401:
					logger.log(logger.error, 'Authentication successful but access to logs folder has been denied.');
					logger.log(logger.error, 'Please add required webdav permissions in BM -> Administration -> Organization -> WebDAV Client Permissions.');
					logger.log(logger.error, 'Sample permissions:');
					logger.log(logger.error, fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8'));
					log('\n');
					logger.log(logger.error, 'Exiting cctail.');
					process.exit(1);
				case 500:
					logger.log(logger.error, 'Authentication successful but attempt to retrieve WebDAV logs failed.');
					logger.log(logger.error, 'Please ensure your WebDAV permissions are syntactically correct and have no duplicate entries.');
					logger.log(logger.error, 'Check in BM -> Administration -> Organization -> WebDAV Client Permissions.');
					logger.log(logger.error, 'Sample permissions:');
					logger.log(logger.error, fs.readFileSync(path.join(__dirname, '../webdav-permissions-sample.json'), 'utf8'));
					log('\n');
					logger.log(logger.error, 'Exiting cctail.');
					process.exit(1);
				default:
					return '';
			}
		}
	},

	fetchFileSize: async function (profile: DwJson, logobj: LogFile): Promise<number> {
		let size = 0;
		try {
			logger.log(logger.debug, chalk.cyan(`Fetching size for ${logobj.log}`), logobj.debug);
			let res = await this.makeRequest(profile, 'HEAD', logobj.log, null, logobj.debug);
			if (res.headers['content-length']) {
				size = parseInt(res.headers['content-length'], 10);
				logger.log(logger.debug, `Fetched size for ${logobj.log}: size ${size}`, logobj.debug);
			} else {
				logger.log(logger.debug, `No content-length returned for ${logobj.log}`, logobj.debug);
			}
		} catch (err) {
			logger.log(logger.error, `Fetching file size of ${logobj.log} failed with error: ${err.message}`);
		}
		return size;
	},

	fetchLogContent: async function (profile: DwJson, logobj: LogFile): Promise<[LogFile, string]> {
		try {
			// If logobj.size is negative, leave as-is but range starts at 0. (Log rollover case)
			let range = 0;
			if (logobj.log.endsWith("log")) {
				if (!logobj.size) {
					let size = await this.fetchFileSize(profile, logobj);
					range = logobj.size = Math.max(size - initialBytesRead, 0);
				} else if (logobj.size > 0) {
					range = logobj.size;
				}
			} else {
				logobj.size = -1;
			}

			let headers = new Map([["Range", `bytes=${range}-`]]);
			let res = await this.makeRequest(profile, 'GET', logobj.log, headers, logobj.debug);
			logger.log(logger.debug, `Fetching contents from ${logobj.log} retured status code ${res.status}`, logobj.debug);
			if (res.status === 206) {
				if (logobj.size < 0) {
					logobj.size = res.data.length;
					return [logobj, res.data];
				}
				if (logobj.size === 0 && res.data.length > initialBytesRead) {
					logobj.size = res.data.length;
					return [logobj, res.data.substring(res.data.length - initialBytesRead)];
				}
				logobj.size += res.data.length;
				return [logobj, res.data];
			}
		} catch (err) {
			if (err.response) {
				logger.log(logger.debug, `Fetching contents from ${logobj.log} returned status code ${err.response.status}`, logobj.debug);
			}
			if (!err.response || err.response.status !== 416) {
				this.errorcount = this.errorcount + 1;
				if (this.errorcount > 1) {
					logger.log(logger.error, `Error fetching contents from ${logobj.log}: ${err.message} (error count ${this.errorcount})`);
				} else {
					// don't be too verbose, just retry if this was the first error
					logger.log(logger.debug, `Error fetching contents from ${logobj.log}: ${err.message} (error count ${this.errorcount})`);
				}
			}
		}
		return [logobj, ''];
	},

	logMissingAuthCredentials: function () {
		logger.log(logger.error, ('Missing authentication credentials. Please add client_id/client_secret or username/password to log.conf.json or dw.json.'));
		logger.log(logger.error, (`Sample config:\n`));
		logger.log(logger.error, (fs.readFileSync(path.join(__dirname, '../log.config-sample.json'), 'utf8')));
		log('\n');
	},

	isUsingAPI: function (profile: DwJson) {
		return (profile.client_id && profile.client_secret)
	},

	isUsingBM: function (profile: DwJson) {
		return (profile.username && profile.password)
	}
}

export default logfetcher;
