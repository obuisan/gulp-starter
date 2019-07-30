/* eslint-disable no-console */
'use strict';
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const isObject = item => item && typeof item === 'object' && !Array.isArray(item);
const mergeDeep = (target, ...sources) => {
  if (!sources.length) return target;
  const source = sources.shift();
  if (isObject(target) && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) {
          Object.assign(target, { [key]: {} });
        } else {
          target[key] = Object.assign({}, target[key]);
        }
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }
  return mergeDeep(target, ...sources);
};
const resolvePath = (relative, basePath) => {
  basePath = basePath.replace(/[/]+$/, '');
  const _resolvePath = (value) => {
    if (Array.isArray(value)) {
      value = value.map(index => _resolvePath(index));
    } else if (typeof value === 'string') {
      if (value.indexOf('/') !== 0) {
        value = (basePath + '/' + value.replace(/^[./]+/, '')).replace(/[/]+$/, '');
      }
    }
    return value;
  };
  return _resolvePath(relative);
};
const normalizeBundle = (optionsDefault, bundle, index) => {
  const bundleName = { name: `bundle${index}` };
  const options = mergeDeep({}, optionsDefault, bundleName, bundle);
  options.src = [].concat(options.src);
  options.src = options.src.map(src => resolvePath(src, config.src));
  options.base = resolvePath(options.base || '', config.src);
  options.dest = resolvePath(options.dest, config.dest);
  return options;
};

var config = {};
switch (process.env.ENVIROMENT) {
  case undefined:
  case 'dev':
  case 'development':
    config = require('./config.json');
    break;
  default:
    config = require('./config-' + process.env.ENVIROMENT + '.json');
};
const configDefault = {
  src: './dev',
  dest: './dist',
  clean: [],
  copy: {
    name: 'html',
    src: './*.html',
    dest: './'
  },
  css: {
    name: 'style',
    src: './sass/**/*.scss',
    dest: './css',
    sourcemaps: true,
    concat: true,
    order: [],
    minify: true,
    rename: true,
    lint: true,
    sass: false
  },
  js: {
    name: 'main',
    src: './js/**/*.js',
    dest: './js',
    sourcemaps: true,
    concat: true,
    order: null,
    minify: true,
    rename: true,
    lint: true,
    babel: false
  }
};
config = mergeDeep({}, configDefault, config);

config.src = process.env.SOURCE_PATH || config.src;
config.dest = process.env.DESTINATION_PATH || config.dest;
config.archive = (process.env.ARCHIVE === 'true') || false;
config.ftpDeploy = (process.env.FTP_DEPLOY === 'true') || false;
config._clean = (process.env.CLEAN === 'true') || false;
config._clean_force = (process.env.CLEAN_FORCE === 'true') || false;
config.proxy = (process.env.PROXY === 'true') || false;

if (!fs.existsSync(config.src)) {
  console.error('Error: Source path ' + config.src + ' doesn\'t exist.');
  process.exit(1);
}

config.clean = ([].concat(config.clean)).map(src => resolvePath(src, config.dest));

config.copy = ([].concat(config.copy)).map((bundle, index) => normalizeBundle(configDefault.copy, bundle, index));

config.css = ([].concat(config.css)).map((bundle, index) => {
  const options = normalizeBundle(configDefault.css, bundle, index);
  options._watch = [];
  if (bundle.sass) {
    options._watch = options.src.filter(src => {
      const partialOrCss = /^(_.*\.(?:scss|sass))|(.*\.css)$/i;
      return !partialOrCss.test(path.basename(src));
    }).map(src => path.dirname(src).replace(/\/\*\*+$/, ''));
    options._watch = [...new Set(options._watch)];
    options._watch = options._watch.filter((src, index, arr) => {
      for (let i = 0; i < arr.length; i++) {
        if (i !== index && src.indexOf(arr[i]) === 0) {
          return false;
        }
      }
      return true;
    }).map(src => src + '/**/_*.(scss|sass)');
  }
  options.order = [].concat(options.order || []);
  return options;
});

config.js = ([].concat(config.js)).map((bundle, index) => {
  const options = normalizeBundle(configDefault.js, bundle, index);
  options.order = [].concat(options.order || []);
  return options;
});

config._browserSync = false;
config._stream = true;
config._currentTask = null;
config._proxy_url = process.env.PROXY_URL || 'https://mydomain.tld/';
config._proxy_path = process.env.PROXY_PATH || '/';
config._ftp = {
  host: process.env.FTP_HOST || 'localhost',
  port: process.env.FTP_PORT || 21,
  user: process.env.FTP_USER || 'anonymous',
  password: process.env.FTP_PASSWORD || 'anonymous@',
  path: process.env.FTP_PATH || './public_html',
  parallel: process.env.FTP_PARALLEL || 10,
  maxConnections: process.env.FTP_MAXCONNECTIONS || 20,
  timeOffset: process.env.FTP_TIMEOFFSET || 0
};

module.exports = config;
