# Salesforce Commerce Cloud log tail

>  Remote tail Salesforce Commerce Cloud logs via webdav. Allow to monitor more logs at once, merging the content of all the files in a single stream.

## Features

* Authentication using API client, no Business Manager username/password required
* Interactive prompt for logs selection
* Support configuration of multiple instances or standard dw.json config file
* Multiple log tailing, with merging/reordering of log entries
* Color output based on log levels
* Converts log timestamp to local timezone

## Installation

```bash
$ npm i -g cctail
```

## Requirements
* Node >= 10

## Configuration

Requires one of the following configuration files:

* a `log.conf.json` file with multiple environments configured. This may be used if you want to easily switch between multiple instances
* a standard `dw.json` file, tipically pointing to your working sandbox.

`cctail` requires a correctly configured API client id/secret for accessing logs via webdav. *Business manager username/password authentication is not supported*.

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
  "dev01": {
    "hostname": "dev01.mysandbox.demandware.net",
    "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "client_secret": "client-secret"
  },
  "dev02": {
    "hostname": "dev02.mysandbox.demandware.net",
    "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    "client_secret": "client-secret"
  }
}
```
If multiple instances are configured you may directly pass the name of the instance for skipping the interactive selection prompt, e.g.:

```bash
$ cctail dev02
```

### API client configuration

The API client must be created from the account.demandware.com console. Before being able to use `cctail` you must grant the required permissions for accessing the logs folder through webdav in any target sfcc instance.

For doing so access Business Manager and add the following in Administration -> Organization -> WebDAV Client Permissions. Replace client id with your client id, you may need to merge these settings with existing ones.

```json
{
  "clients": [
    {
      "client_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "permissions": [
        {
          "path": "/logs",
          "operations": [
            "read_write"
          ]
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