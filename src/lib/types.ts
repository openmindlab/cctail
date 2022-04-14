import moment from 'moment';

export interface DwJson {
	hostname: string,
	client_id?: string,
	log_path?: 'site' | 'security' | 'all',
	client_secret?: string,
	username?: string,
	password?: string,
	log_types?: string[]
	polling_interval?: number,
	refresh_loglist_interval?: number,
	token?: string,
	token_type?: string,
	token_expiry?: moment.Moment
}

export interface LogFile {
	log: string,
	size_string: string,
	date: moment.Moment,
	size?: number,
	debug: boolean
}

export interface LogLine {
	message: string,
	level: string,
	timestamp: moment.Moment,
	logfile?: string
}

export interface LogConfig {
	profiles: Profiles,
	fluent?: FluentConfig,
	interactive?: boolean,
}

export interface Profiles {
	[name: string]: DwJson
}

export interface FluentConfig {
	enabled: boolean,
	host?: string,
	port?: number,
	reconnect_interval?: number,
	timeout?: number,
	tag_prefix?: string
}
