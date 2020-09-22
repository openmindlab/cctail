# Salesforce Commerce Cloud log tail

> Remote tail Salesforce Commerce Cloud logs via webdav. Allow to monitor more logs at once, merging the content of all the files in a single stream. Reports either to console or a FluentD collector.

<div>
	<br>
	<a href="https://openmindonline.it" target="_blank"><img width="200" src="openmind.svg" alt="openmind"></a>
	<br>
	<br>
</div>

## Features

- Authentication using API Client _(recommended)_ OR Business Manager _(deprecated)_
- Interactive prompt for logs selection OR selection of logs by config file.
- Supports configuration of multiple instances OR standard dw.json config file
- Outputs to console OR FluentD collector
- Multiple log tailing, with merging of log entries
- In Console mode:
	- Sorts log entries by timestamp
	- Colors output based on log levels
	- Converts log timestamp to local timezone

## Installation

```bash
$ npm i -g cctail
```

## Requirements

- Node >= 10

## Configuration

Requires one of the following configuration files:

- a `log.conf.json` file with multiple environments configured. This may be used if you want to easily switch between multiple instances
- a standard `dw.json` file, tipically pointing to your working sandbox.

`cctail` requires a correctly configured API client id/secret OR Business Manager username/password for accessing logs via webdav. **API client authentication is recommended, because it is faster after the initial authorization, and Business Manager authentication to WebDAV has been _deprecated_ by SalesForce.**

### Optional Configurations

- `"profiles"`:
		- Standard log types: `analytics`, `api`, `console`, `customdebug`, `customerror`, `customfatal`, `custominfo`, `customwarn`, `dbinit-sql`, `debug`, `deprecation`, `error`, `fatal`, `info`, `jobs`, `migration`, `performance`, `quota`, `sql`, `staging`, `sysevent`, `syslog`, `warn` 
	- `"log_types": ["log", "types", "array"]` _(default: all log types)_ - In non-interactive mode, defining this will limit the log types that cctail collects to this list.
		- Standard log types: `analytics`, `api`, `console`, `customdebug`, `customerror`, `customfatal`, `custominfo`, `customwarn`, `dbinit-sql`, `debug`, `deprecation`, `error`, `fatal`, `info`, `jobs`, `migration`, `performance`, `quota`, `sql`, `staging`, `sysevent`, `syslog`, `warn`
	- `"polling_interval": nnn` _(default: `3`)_ - Frequency (seconds) with which cctail will poll the logs.
	 	- If you are using non-interactive mode to pipe the logs elsewhere (i.e. FluentD), a longer interval is recommended (i.e. 30 or 60).
	- `"refresh_loglist_interval": nnn` _(default: `600`)_ - In non-interactive mode, this is the frequency (seconds) in which cctail will check the WebDAV server for new logs that match your `log_types` criteria.
- `"interactive": true|false` _(default: `true`)_ - Interactive mode asks which logs you will want to tail. If `false`, cctail will tail all of today's logs by default.

#### FluentD
**NOTE:** All configurations for fluentD are _optional_, except `enabled` must be set to `true` if you want to use it.

- `fluent`:
	- `"enabled": true|false` _(default: `false`)_ - If enabled, logs will be directed to the Fluent collector.
	- `"host": "fluentd.yourco.com"` _(default: `localhost`)_ - FluentD collector host
	- `"port": nnn` _(default: `24224`)_ - FluentD collector port
	- `"reconnect_interval": nnn` _(default: `600`)_ - If the collector can't be reached, cctail will try to reconnect again in `nnn` seconds.
	- `"timeout": nnn` _(default: `3`)_ - Timeout to connect to FluentD collector
	- `"tag_prefix": "your_tag_prefix"` _(default: `sfcc`)_ - All logs sent to FluentD will have this prefix, followed by the log type (i.e. "sfcc.customerror").

### Sample configuration files

Sample dw.json:
```json
{
  "hostname": "dev01-mysandbox.demandware.net",
  "client_id": "a12464ae-b484-4b90-4dfe-17e20844e9f0",
  "client_secret": "mysupersecretpassword"
}
```

Sample log.conf.json:
```json
{
  "profiles": {
    "dev01-api-client-example": {
      "hostname": "dev01-mysandbox.demandware.net",
      "client_id": "a12345ae-b678-9b01-2dfe-34e56789e0f1",
      "client_secret": "mysupersecretsecret",
      "polling_interval": 30,
			"refresh_loglist_interval": 900
    },
    "dev02-bm-example": {
      "hostname": "dev02-mysandbox.demandware.net",
      "username": "user@yourco.com",
      "password": "mysupersecretpassword",
      "log_types": [ "customerror", "customwarn", "error", "jobs", "warn" ],
      "polling_interval": 60
    }
  },
  "interactive": false,
  "fluent": {
    "enabled": true
  }
}
```

If multiple instances are configured, you may directly pass the name of the instance for skipping the interactive selection prompt, e.g.:
```bash
$ cctail dev02
```

### API client configuration

The API client id must be created in the account.demandware.com console. Before being able to use `cctail` you must grant the required permissions to that client id for accessing the logs folder through WebDAV in any target SFCC instance.

To do so, access Business Manager and add the following to Administration -> Organization -> WebDAV Client Permissions, replacing the client_id value with your client id. **Note:** you may need to merge these settings with existing ones.

```json
{
  "clients": [
    {
      "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "permissions": [
        {
          "path": "/logs",
          "operations": ["read_write"]
        }
      ]
    }
  ]
}
```

## Usage

```bash
$ cctail
```

Run `cctail` in a folder containing either a log.conf-json or dw.json config file.
The tool will display the list of available logs in order to let you interactively select the ones you want to monitor.

## License

Copyright (c) 2019 openmind

Released under the MIT license.
