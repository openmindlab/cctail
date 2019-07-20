/* eslint-disable no-undef */
const fs = require('fs')
const util = require('util');
const path = require('path');
const logparser = require('../lib/logparser')
const logemitter = require('../lib/logemitter');

const readFile = util.promisify(fs.readFile);

let jobcontent;
let files;

beforeAll(() => {
  jobcontent = fs.readFileSync('__tests__/logs/sample-jobs.log', 'UTF-8');
  files = fs
    .readdirSync('__tests__/logs').map(name => { return readFile(path.join('__tests__/logs', name), 'UTF-8') });
});

test('correct number of items when parsing a single file', () => {
  let result = logparser.parseLog(fs.readFileSync('__tests__/logs/sample-warn.log', 'UTF-8'));
  expect(result.length).toBe(5);
});

test('correct number of items when parsing job log file without level', () => {
  let result = logparser.parseLog(jobcontent);
  expect(result.length).toBe(10);
});

test('message content is right', () => {
  let result = logparser.parseLog(fs.readFileSync('__tests__/logs/sample-warn.log', 'UTF-8'));
  expect(result[0].message).toBe('first line of log with missing info');
  expect(result[1].message).toBe('PipelineCallServlet|1692371210|Adyen-Notify|PipelineCall|RrCsCHDvb2 custom []  multiline start\nmultiline second line\nmultiline third line');
  expect(result[2].message).toBe('PipelineCallServlet|1692371210|Adyen-Notify|PipelineCall|RrCsCHDvb2 custom []  .*#GET#TOP <-> Adyen-Notify#POST#TOP');
  expect(result[4].message).toBe('PipelineCallServlet|899141122|Adyen-Notify|PipelineCall|GUfhepk_2C custom []  .*#GET#TOP <-> Adyen-Notify#POST#TOP\nlast line');
});


test('logs are sorted', () => {
  let result = logemitter.sort(logparser.parseLog(fs.readFileSync('__tests__/logs/sample-unsorted.log', 'UTF-8')));
  expect(result[0].message).toBe('one');
  expect(result[1].message).toBe('two');
  expect(result[2].message).toBe('three');
  expect(result[3].message).toBe('four');
});


test('parse multiple files', async () => {
  let parsed = await logparser.process(files);
  expect(parsed.length).toBe(23);
});

