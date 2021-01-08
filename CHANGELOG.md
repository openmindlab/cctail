## Change Log

### v1.5.1 (2021/01/08)

- Support for environment variables for use in profiles.

### v1.5.0 (2021/01/06)

- Improved stability, re-authentication is more reliable now.

### v1.4.0 (2020/09/18)

- Support for FluentD as a log collector
- Headless mode - tail logs based on config file
- Added Business Manager as an authentication method
- Standardized console.log color outputs & debug logging

### v1.3.2 (2020/08/27)

- Update dependencies
- Fix parsing of numeric arguments (when using something like 001 as an environment name)

### v1.3.0 (2020/07/27)

- Improved retry in case of expired auth.

### v1.2.0 (2020/04/26)

- Update dependencies, migrated to typescript.

### v1.1.3 (2019/11/29)

- Handling of PIG instances behind cloudflare, even if we are not getting content-length headers here.

### v1.1.2 (2019/08/22)

- Better sorting of same-second log entries.

### v1.1.1 (2019/08/15)

- Brighter, more readable log colors.

### v1.1.0 (2019/08/04)

- Remove dependency on sfcc-ci for authentication. No more salesforce private deps, feeling a bit more free and snappy now.
- Automatically refresh access token for your long tailing sessions
- Better handling of hanging connections, now they will timeout sooner so we can retry without loosing too much time.

### v1.0.0 (2019/07/20)

- First public release
