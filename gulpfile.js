/* eslint-disable no-console */
'use strict';
const config = require('./configurator');

const autoprefixer = require('gulp-autoprefixer');
const babel = require('gulp-babel');
const browserSync = require('browser-sync').create();
const c = require('ansi-colors');
const concat = require('gulp-concat');
const cssnano = require('cssnano');
const del = require('del');
const eslint = require('gulp-eslint');
const filter = require('gulp-filter');
const ftp = require('vinyl-ftp');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const lineEndingCorrector = require('gulp-line-ending-corrector');
const mqPacker = require('css-mqpacker');
const notify = require('gulp-notify');
const order = require('gulp-order');
const perfectionist = require('perfectionist');
const plumber = require('gulp-plumber');
const postcss = require('gulp-postcss');
const rename = require('gulp-rename');
const sass = require('gulp-sass');
sass.compiler = require('node-sass');
const sassGlob = require('gulp-sass-glob');
const sourcemaps = require('gulp-sourcemaps');
const stylelint = require('gulp-stylelint');
const uglify = require('gulp-uglify');
const zip = require('gulp-zip');

const consoleError = (error) => {
  let message = error.messageOriginal ? error.messageOriginal : error.message;
  let report = '';
  let chalk = c.white.bgRed;
  report += chalk('TASK:') + ' [' + error.plugin + ']\n';
  report += chalk('PROB:') + ' ' + message + '\n';
  if (error.line) {
    report += chalk('LINE:') + ' ' + error.line + '\n';
  }
  if (error.file) {
    report += chalk('FILE:') + ' ' + error.file + '\n';
  }
  console.error(report);
};

const handleError = function (error) {
  let message = error.messageOriginal ? error.messageOriginal : error.message;

  if (error.plugin === 'gulp-stylelint') {
    return handleWarning(error);
  }

  notify.logLevel(0);
  notify({
    title: `Error ${error.plugin}`,
    message: `${message}`,
    wait: true,
    sound: false
  }).write(error);

  consoleError(error);

  if (config._currentTask === 'build') {
    setTimeout(() => process.exit(1), 100);
  }
  gulp.emit('end');
};

const handleWarning = (error) => {
  consoleError(error);
  gulp.emit('end');
};

const displaySubTaskName = (task, subtask, name) => task + c.gray(subtask) + c.greenBright(name);

const ftpConn = () => ftp.create({
  host: config._ftp.host,
  port: config._ftp.port,
  user: config._ftp.user,
  password: config._ftp.password,
  parallel: config._ftp.parallel,
  maxConnections: config._ftp.maxConnections,
  timeOffset: config._ftp.timeOffset,
  idleTimeout: 10000
});

/**
 * Task: `copy`.
 */
function copyBundleTask(bundle, index) {
  function copyBundle() {
    return gulp.src(bundle.src, { base: bundle.base, allowEmpty: true })
      .pipe(plumber({ errorHandler: handleError }))
      .pipe(gulp.dest(bundle.dest))
      /** @todo improve this filter */
      .pipe(filter(['**/*.css', '**/*.html', '**/*.js', '**/*.php', '**/*.(jpg|png|svg|webp)']))
      .pipe(gulpif(config._browserSync && config._stream, browserSync.stream()));
  }
  copyBundle.displayName = displaySubTaskName('copy', ':bundle ', bundle.name);
  return copyBundle;
}
function copyTask(done) {
  let tasks = config.copy.map(copyBundleTask);
  return gulp.series(...tasks)(done);
}
gulp.task('copy', copyTask);

/**
 * Task: `css`.
 */
function cssBundleTask(bundle, index) {
  function cssBundle(done) {
    let cssFilter = filter(['**/*.css', '**/*.min.css']);
    let sassFilter = filter(['**/*.scss'], { restore: true });
    let task = gulp.src(bundle.src, { base: bundle.base, allowEmpty: true })
      .pipe(plumber({ errorHandler: handleError }));
    if (bundle.sass) {
      task = task.pipe(sassFilter)
        .pipe(gulpif(bundle.lint, stylelint({ reporters: [{ formatter: 'string', console: true }] })))
        .pipe(gulpif(bundle.sourcemaps, sourcemaps.init({ loadMaps: true })))
        .pipe(sassGlob())
        .pipe(sass({ includePaths: ['./bower_components', './node_modules'], outputStyle: 'expanded' }))
        .pipe(lineEndingCorrector())
        .pipe(gulpif(bundle.sourcemaps, sourcemaps.write({ includeContent: false, addComment: false })))
        .pipe(sassFilter.restore);
    }
    task = task.pipe(gulpif(bundle.sourcemaps, sourcemaps.init({ loadMaps: true })))
      .pipe(autoprefixer({ cascade: true, grid: true }))
      .pipe(postcss([perfectionist()]))
      .pipe(gulpif(bundle.concat, order(bundle.order)))
      .pipe(gulpif(bundle.concat, concat(bundle.name + '.css')))
      .pipe(lineEndingCorrector())
      .pipe(gulpif(bundle.sourcemaps, sourcemaps.write('.', { addComment: true })))
      .pipe(gulp.dest(bundle.dest))
      .pipe(gulpif((config._browserSync && config._stream), browserSync.stream()))
      .pipe(gulpif(bundle.sourcemaps, cssFilter));
    if (bundle.minify) {
      task = task.pipe(gulpif(bundle.sourcemaps, sourcemaps.init({ loadMaps: true })))
        .pipe(postcss([cssnano({ sourcemap: true }), mqPacker]))
        .pipe(gulpif(bundle.rename, rename({ suffix: '.min' })))
        .pipe(lineEndingCorrector())
        .pipe(gulpif(bundle.sourcemaps, sourcemaps.write('.', { addComment: true })))
        .pipe(gulp.dest(bundle.dest))
        // .pipe(gulpif(bundle.sourcemaps, cssFilter))
        .pipe(gulpif(config._browserSync && config._stream, browserSync.stream()));
    }
    return task.on('error', handleError).on('end', done);
  }
  cssBundle.displayName = displaySubTaskName('css', ':bundle ', bundle.name);
  return cssBundle;
};

function cssTask(done) {
  let tasks = config.css.map(cssBundleTask);
  return gulp.series(...tasks)(done);
}
gulp.task('css', cssTask);

/**
 * Task: `js`.
 */
function jsBundleTask(bundle, index) {
  function jsBundle() {
    let jsFilter = filter(['**/*.js']);
    return gulp.src(bundle.src, { base: bundle.base, allowEmpty: true })
      .pipe(plumber({ errorHandler: handleError }))
      .pipe(gulpif(bundle.lint, eslint()))
      .pipe(gulpif(bundle.lint, eslint.format()))
      .pipe(gulpif(bundle.lint, eslint.failAfterError()))
      .pipe(gulpif(bundle.sourcemaps, sourcemaps.init({ loadMaps: true })))
      .pipe(gulpif(bundle.babel, babel()))
      .pipe(gulpif(bundle.concat, order(bundle.order)))
      .pipe(gulpif(bundle.concat, concat(bundle.name + '.js')))
      .pipe(lineEndingCorrector())
      .pipe(gulpif(bundle.sourcemaps, sourcemaps.write('.', { addComment: true })))
      .pipe(gulp.dest(bundle.dest))
      .pipe(gulpif(config._browserSync && config._stream, browserSync.stream()))
      .pipe(gulpif(bundle.sourcemaps, jsFilter))
      .pipe(gulpif(bundle.sourcemaps, sourcemaps.init({ loadMaps: true })))
      .pipe(gulpif(bundle.minify, uglify()))
      .pipe(gulpif(bundle.rename, rename({ suffix: '.min' })))
      .pipe(lineEndingCorrector())
      .pipe(gulpif(bundle.sourcemaps, sourcemaps.write('.', { addComment: true })))
      .pipe(gulp.dest(bundle.dest))
      // .pipe(gulpif(bundle.sourcemaps, jsFilter))
      .pipe(gulpif(config._browserSync && config._stream, browserSync.stream()));
  }
  jsBundle.displayName = displaySubTaskName('js', ':bundle ', bundle.name);
  return jsBundle;
}

function jsTask(done) {
  let tasks = config.js.map(jsBundleTask);
  return gulp.series(...tasks)(done);
}
gulp.task('js', jsTask);

/**
 * Task: `ftp`.
 */
gulp.task('ftp:clean', (done) => {
  let conn = ftpConn();
  return conn.clean(config._ftp.path + '/**', config.dest).on('error', handleError).on('end', done);
});

function ftpTask(glob) {
  function ftpUpload(done) {
    let conn = ftpConn();
    return gulp.src(glob, { buffer: false, base: config.dest })
      .pipe(plumber({ errorHandler: handleError }))
      .pipe(conn.newerOrDifferentSize(config._ftp.path))
      .pipe(conn.dest(config._ftp.path)).on('end', done)
      .pipe(filter(['**', '!**/*.map']))
      .pipe(gulpif(config._browserSync, browserSync.stream()));
  }
  ftpUpload.displayName = displaySubTaskName('ftp', ':sync ', glob);
  return ftpUpload;
}
gulp.task('ftp:deploy', ftpTask(config.dest + '/**/*'));

/**
 * Task: `build`.
 */
const build = (done) => {
  config._currentTask = 'build';
  let tasks = [];
  if (config._clean) {
    tasks.push('clean');
  }
  tasks.push('css', 'js', 'copy');
  if (config.archive) {
    tasks.push('archive');
  }
  if (config.ftpDeploy && config._clean) {
    tasks.push('ftp:clean');
  }
  if (config.ftpDeploy) {
    tasks.push('ftp:deploy');
  }
  return gulp.series(...tasks)(done);
};
gulp.task('build', build);

/**
 * Task: `watch`.
 */
const watch = (done) => {
  build(() => {
    config._currentTask = 'watch';
    config.copy.forEach((bundle, index) => {
      let copyChanged = (event, eventPath) => {
        if (event === 'add' || event === 'change') {
          let partialBundle = { ...bundle };
          partialBundle.src = eventPath;
          return gulp.series(copyBundleTask(partialBundle, index))();
        } else if (event === 'unlink') {
          /** @todo pending */
        }
      };
      gulp.watch(bundle.src).on('all', copyChanged);
    });
    config.css.forEach((bundle, index) => gulp.watch(bundle.src.concat(bundle._watch), cssBundleTask(bundle, index)));
    config.js.forEach((bundle, index) => gulp.watch(bundle.src, jsBundleTask(bundle, index)));
    if (config.ftpDeploy) {
      let ftpChanged = (event, eventPath) => {
        if (event === 'add' || event === 'change') {
          return gulp.series(ftpTask(eventPath))();
        }
      };
      gulp.watch(config.dest + '/**/*').on('all', ftpChanged);
    }
    done();
  });
};
gulp.task('watch', watch);

/**
 * Task: `serve`.
 */
gulp.task('serve', (done) => {
  let options = config.proxy ? { proxy: config._url } : { server: { baseDir: config.dest } };
  config._browserSync = true;
  config._stream = !config.ftpDeploy;
  watch(() => {
    browserSync.init(options);
    done();
  });
});

/**
 * Task: `archive`.
 */
gulp.task('archive', () =>
  gulp.src(config.src + '/**/*')
    .pipe(plumber({
      errorHandler: handleError
    }))
    .pipe(zip('source_' + (new Date()).toISOString().slice(0, 19).replace(/:|-/g, '') + '.zip'))
    .pipe(gulp.dest(config.dest))
);

/**
 * Task: `clean`.
 */
gulp.task('clean', () => del(config.clean));

/**
 * Task: `default`.
 */
gulp.task('default', gulp.series('serve'));
