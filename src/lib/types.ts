import moment from 'moment';

export interface DwJson {
  client_id: string,
  client_secret: string,
  hostname: string,
  log_types?: string[]
  polling_interval?: number,
  auth_type?: string,
  token?: string,
  token_type?: string,
  token_expiry?: moment.Moment
}

export interface LogFile {
  log: string,
  size_string: string,
  date: moment.Moment,
  size?: number,
  debug: boolean,
  rolled_over?: boolean
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
