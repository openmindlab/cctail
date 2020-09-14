#!/usr/bin/env node

import path from 'path';
import prompts, { Choice } from 'prompts';
import chalk from 'chalk';
import fs from 'fs';
import moment from 'moment';
import yargs from 'yargs';
import s from 'underscore.string';

import logfetcher from './lib/logfetcher';
import logparser from './lib/logparser';
import logemitter from './lib/logemitter';
import LogFluent from './lib/logfluent';
import { LogConfig, LogFile, DwJson, Profiles, FluentConfig } from './lib/types';

const { log } = console;

let fluent: LogFluent;
let logConfig: LogConfig;
let profiles: Profiles;
let profile: DwJson;
let debug = false;
let interactive = true;
let pollingSeconds = 3;

let run = function () {
  let packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));
  log(`cctail - v${packageJson.version} - (c) openmind`);

  readLogConf();

  if (!profiles || Object.keys(profiles).length === 0) {
    log(chalk.yellow(`No profiles in log.conf.json, checking for dw.json in path ${process.cwd()}\n`));
    readDwJson();
  }

  yargs.parserConfiguration({
    "parse-numbers": false
  });

  const args = yargs.argv

  if (args.d) {
    debug = true;
  }

  if (interactive) {
    interact(args._[0]);
  } else {
    dontInteract(args._[0]);
  }
}

let dontInteract = async function(profilename: string) {
  if (Object.keys(profiles).length === 1) {
    profile = profiles[Object.keys(profiles)[0]];
  } else if (!profilename) {
    log(chalk.red('ERROR: No profile selected, exiting\n'));
    process.exit(-1);
  } else if (!profiles[`${profilename}`]) {
    log(chalk.red(`ERROR: Specified profile ${profilename} not found.\n`));
    process.exit(-1);
  } else {
    profile = profiles[profilename];
  }

  setPollingInterval(profile);
  // Which logs to obtain are configured in the profile
  let fileobjs = await getThatLogList(profile);
  setImmediate(pollLogs, fileobjs);
}

let interact = async function(profilename: string) {
  if (Object.keys(profiles).length === 1) {
    profile = profiles[Object.keys(profiles)[0]];
  }
  else {
    if (profilename === undefined) {
      const profileselection = await prompts({
        type: 'select',
        name: 'value',
        message: 'Select a profile:',
        choices: Object.keys(profiles).map(i => ({
          title: `  [${i}] ${profiles[i].hostname}`,
          value: `${i}`
        }))
      });
      profilename = profileselection.value;
    }

    if (!profilename) {
      log('No profile selected, exiting\n');
      process.exit(-1);
    }

    if (!profiles[`${profilename}`]) {
      log(chalk.red(`ERROR: Specified profile ${profilename} not found.\n`));
      process.exit(-1);
    }

    profile = profiles[profilename];
  }

  setPollingInterval(profile);

  let fileobjs = await getThatLogList(profile);
  fileobjs.sort((a, b) => b.date.unix() - a.date.unix());

  let logx: LogFile[] = [];
  let logchoiche: Choice[] = [];

  for (let i in fileobjs) {
    let sizeformatted = s.lpad(fileobjs[i].size_string, 12);
    if (sizeformatted.trim() !== '0.0 kb') {
      sizeformatted = chalk.yellow(sizeformatted);
    }
    let dateformatted = s.lpad(fileobjs[i].date.format('YYYY-MM-DD HH:mm:ss'), 20);
    if (fileobjs[i].date.isSame(moment.utc(), 'hour')) {
      dateformatted = chalk.yellow(dateformatted);
    }
    let logname = s.rpad(fileobjs[i].log, 70);

    logname = colorize(logname, logname);

    logchoiche.push({
      title: `${chalk.green(s.lpad(i, 2))} ${logname} ${sizeformatted}  ${dateformatted}`,
      value: i
    });
  }

  let logselection = await prompts({
    type: 'autocompleteMultiselect',
    name: 'value',
    message: `Select logs on [${chalk.green(profile.hostname)}]`,
    choices: logchoiche,
    // eslint-disable-next-line no-return-assign
    onState: ((statedata) => { statedata.value.forEach((i: Choice) => i.title = `\n${i.title}`) })
  });

  if (!logselection.value || logselection.value.length === 0) {
    log('No log selected, exiting.\n');
    process.exit(-1);
  }

  logselection.value.forEach((i: number) => {
    logx.push(fileobjs[i]);
  });

  log('\n');

  setImmediate(pollLogs, logx);
};

let setPollingInterval = function(profile: DwJson) {
  if (profile.polling_interval) {
    pollingSeconds = profile.polling_interval;
    log('Setting polling interval (seconds): ' + pollingSeconds);
  } else {
    log('Using default polling interval (seconds): ' + pollingSeconds);
    profile.polling_interval = pollingSeconds;
  }
}

let getThatLogList = async function(profile: DwJson): Promise<LogFile[]> {
  let fileobjs: LogFile[] = [];

  let data = await logfetcher.fetchLogList(profile);

  let regexp = new RegExp(`<a href="/on/demandware.servlet/webdav/Sites/Logs/(.*?)">[\\s\\S\\&\\?]*?<td align="right">(?:<tt>)?(.*?)(?:<\\/tt>)?</td>[\\s\\S\\&\\?]*?<td align="right"><tt>(.*?)</tt></td>`, 'gim');
  let match = regexp.exec(data);

  while (match != null) {
    let logShortName = match[1].substr(0, match[1].indexOf('-'));
    let filedate = moment.utc(match[3]);
    if (match[1].substr(-4) === '.log' && filedate.isSame(moment.utc(), 'day') &&
      (interactive || !profile.log_list || profile.log_list.indexOf(logShortName) > -1)
    ) {
      fileobjs.push({
        log: match[1],
        size_string: match[2],
        date: moment.utc(match[3]),
        debug: debug
      });
      if(debug || !interactive) {
        log("Log added to list: " + match[1]);
      }
    }
    match = regexp.exec(data);
  }

  return fileobjs;
}

let pollLogs = async function(fileobjs: LogFile[]) {
  if (fileobjs.length === 0) {
    log('No logs to show, exiting.\n');
    process.exit(-1);
  }

  // if (debug) {
  //  log(`Log date: ${fileobjs[0].date.format('ll')}`);
  //  log(`Today's date: ${moment.utc().format('ll')}`);
  // }
  if (!interactive && moment.utc().isAfter(fileobjs[0].date, 'day')) {
    log('Logs have rolled over, re-populating log list.')
    fileobjs = await getThatLogList(profile);
    for(let i of fileobjs) {
      i.rolled_over = true;
    }
  } else if (debug) {
    log('Logs have not rolled over since last poll cycle.')
  }

  if (fluent) {
    fluent.output(profile.hostname,
      await logparser.process(fileobjs.map((logobj) => logfetcher.fetchLogContent(profile, logobj))),
      false, fileobjs[0].debug);
  } else {
    let parsed = logemitter.sort(
      await logparser.process(fileobjs.map((logobj) => logfetcher.fetchLogContent(profile, logobj)))
    );
    logemitter.output(parsed, false, fileobjs[0].debug);
  }
  setTimeout(pollLogs, pollingSeconds * 1000, fileobjs);
}

function readDwJson() {
  let dwJsonPath = path.join(process.cwd(), 'dw.json');
  log(`Loading profile from ${dwJsonPath}\n`);
  try {
    const dwJson = JSON.parse(fs.readFileSync(dwJsonPath, 'utf8'));
    const name = dwJson.profile || dwJson.hostname.split('-')[0].split('-')[0];
    profiles[name] = dwJson;
  }
  catch (err) {
    log(chalk.red(`No dw.json found in path ${process.cwd()}\n`));
    process.exit(-1);
  }
}

function colorize(logname: string, text: string) {
  if (s.contains(logname, 'error') || s.contains(logname, 'fatal')) {
    return chalk.red(text);
  }
  if (s.contains(logname, 'warn')) {
    return chalk.yellow(text);
  }
  if (s.contains(logname, 'info')) {
    return chalk.green(text);
  }
  if (s.contains(logname, 'jobs')) {
    return chalk.blue(text);
  }
  return text;
}

function readLogConf() {
  try {
    logConfig = JSON.parse(fs.readFileSync(`${process.cwd()}/log.conf.json`, 'utf8'));
    profiles = logConfig.profiles;
    if (logConfig.interactive !== undefined && logConfig.interactive === false) {
      interactive = false;
      log("Interactive mode is disabled.");
    }
    if (logConfig.fluent !== undefined && logConfig.fluent.enabled === true) {
      let fluentConfig: FluentConfig = logConfig.fluent;
      fluent = new LogFluent(fluentConfig);
      log("FluentD output is enabled.");
    }
  } catch (err) {
    log(chalk.red('\nMissing or invalid log.conf.json.\n'));
    log(chalk.red(`Sample config:\n`));
    log(chalk.red(fs.readFileSync(path.join(__dirname, './log.config-sample.json'), 'utf8')));
    log('\n');
    process.exit(1);
  }
}

run();
