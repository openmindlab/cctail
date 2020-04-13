import moment from 'moment';


export interface DwJson {
  client_id: string,
  client_secret: string,
  hostname: string,
  token?: string
}

export interface LogFile {
  log: string,
  sizestring: string,
  date: moment.Moment,
  size?: number,
  debug: boolean
}


export interface LogLine {
  message: string,
  level: string,
  timestamp: moment.Moment
}

export interface LogConfig {
  [name: string]: DwJson;
}

