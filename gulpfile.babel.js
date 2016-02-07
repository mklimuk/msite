'use strict';

import gulp from 'gulp';
// Loads the plugins without having to list all of them, but you need
// to call them as $.pluginname
import gulpLoadPlugins from 'gulp-load-plugins';
const $ = gulpLoadPlugins();
// Delete stuff
import del from 'del';
// Used to run shell commands
import shell from 'shelljs';
// Parallelize the uploads when uploading to Amazon S3
import parallelize from 'concurrent-transform';
// AutoPrefixer
import autoprefixer from 'autoprefixer';
// Yargs for command line arguments
import {
  argv
}
from 'yargs';

let libs = [
  'node_modules/jquery/dist/jquery.min.js',
  'node_modules/skel/index.js'
];

let src = [
  'src/assets/javascript/main.js',
  'src/assets/javascript/libs.js'
];

// 'gulp clean:dist' -- erases the dist folder
// 'gulp clean:metadata' -- deletes the metadata file for Jekyll
gulp.task('clean:dist', () => {
  return del(['dist/']);
});
gulp.task('clean:metadata', () => {
  return del(['src/.jekyll-metadata']);
});

// 'gulp jekyll' -- builds your site with development settings
// 'gulp jekyll --prod' -- builds your site with production settings
gulp.task('jekyll', done => {
  if (!argv.prod) {
    shell.exec('bundle exec jekyll build');
    done();
  } else if (argv.prod) {
    shell.exec('bundle exec jekyll build --config _config.yml,_config.build.yml');
    done();
  }
});

// 'gulp doctor' -- literally just runs jekyll doctor
gulp.task('jekyll:doctor', done => {
  shell.exec('bundle exec jekyll doctor');
  done();
});

// 'gulp styles' -- creates a CSS file from your SASS, adds prefixes and
// creates a Sourcemap
// 'gulp styles --prod' -- creates a CSS file from your SASS, adds prefixes and
// then minifies, gzips and cache busts it. Does not create a Sourcemap
gulp.task('styles', () =>
  gulp.src('src/assets/scss/style.scss')
  .pipe($.sourcemaps.init())
  .pipe($.sass({
    precision: 10
  }).on('error', $.sass.logError))
  .pipe($.postcss([
    autoprefixer({
      browsers: 'last 1 version'
    })
  ]))
  .pipe($.size({
    title: 'css',
    showFiles: true
  }))
  .pipe(gulp.dest('dist/assets/css')) // write full css version
  .pipe($.rename({
    suffix: '.min'
  }))
  .pipe($.if('*.css', $.cssnano()))
  .pipe($.size({
    title: 'minified css',
    showFiles: true
  }))
  .pipe($.rev())
  .pipe($.sourcemaps.write('.'))
  .pipe(gulp.dest('dist/assets/css')) // write minified css
  .pipe($.if('*.css', $.gzip({
    append: true
  })))
  .pipe($.size({
    title: 'gzipped css',
    gzip: true,
    showFiles: true
  }))
  .pipe(gulp.dest('dist/assets/css')) // write gzipped css
);

// 'gulp libs' -- concatenates libs into one file
gulp.task('libs', () =>
    gulp.src(libs)
    .pipe($.concat('libs.js'))
    .pipe(gulp.dest('src/assets/javascript'))
);

// 'gulp scripts' -- creates a index.js file from your JavaScript files and
// creates a Sourcemap for it
// 'gulp scripts --prod' -- creates a index.js file from your JavaScript files,
// minifies, gzips and cache busts it. Does not create a Sourcemap
gulp.task('scripts', gulp.series('libs', () =>
  // NOTE: The order here is important since it's concatenated in order from
  // top to bottom, so you want vendor scripts etc on top
  gulp.src(src)
  .pipe($.newer('dist/assets/js/app.js', {
    dest: 'dist/assets/js',
    ext: '.js'
  }))
  .pipe($.sourcemaps.init())
  .pipe($.concat('app.js'))
  .pipe($.size({
    title: 'javascript',
    showFiles: true
  }))
  .pipe(gulp.dest('dist/assets/js')) // write regular js
  .pipe($.rename({
    suffix: '.min'
  }))
  .pipe($.if('*.js', $.uglify({
    preserveComments: false
  })))
  .pipe($.size({
    title: 'minified javascript',
    showFiles: true
  }))
  .pipe($.rev())
  .pipe($.sourcemaps.write('.'))
  .pipe(gulp.dest('dist/assets/js'))
  .pipe($.if('*.js', $.gzip({
    append: true
  })))
  .pipe($.size({
    title: 'gzipped javascript',
    gzip: true,
    showFiles: true
  }))
  .pipe(gulp.dest('dist/assets/js'))
));

// 'gulp inject:head' -- injects our style.css file into the head of our HTML
gulp.task('inject:head', () =>
  gulp.src('dist/**/*.html')
  .pipe($.inject(gulp.src('dist/assets/css/*.min.css', {
    read: false
  }), {
    ignorePath: 'dist',
    selfClosingTag: true
  }))
  .pipe(gulp.dest('dist'))
);

// 'gulp inject:footer' -- injects our index.js file into the end of our HTML
gulp.task('inject:footer', () =>
  gulp.src('dist/**/*.html')
  .pipe($.inject(gulp.src('dist/assets/js/*.min.js', {
    read: false
  }), {
    ignorePath: 'dist',
    selfClosingTag: true
  }))
  .pipe(gulp.dest('dist'))
);

// 'gulp images' -- optimizes and caches your images
gulp.task('images', () =>
  gulp.src('src/assets/images/**/*')
  .pipe($.cache($.imagemin({
    progressive: true,
    interlaced: true
  })))
  .pipe(gulp.dest('dist/assets/images'))
  .pipe($.size({
    title: 'images'
  }))
);

// 'gulp fonts' -- copies your fonts to the temporary assets folder
gulp.task('fonts', () =>
  gulp.src('src/assets/fonts/**/*')
  .pipe(gulp.dest('dist/assets/fonts'))
  .pipe($.size({
    title: 'fonts'
  }))
);

// 'gulp html' -- minifies and gzips our HTML files
gulp.task('html', () =>
  gulp.src('dist/**/*.html')
  .pipe($.rename({
    suffix: '.min'
  }))
  .pipe($.htmlmin({
    removeComments: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true
  }))
  .pipe($.size({
    title: 'optimized HTML'
  }))
  .pipe(gulp.dest('dist'))
  .pipe($.gzip({
    append: true
  }))
  .pipe($.size({
    title: 'gzipped HTML',
    gzip: true
  }))
  .pipe(gulp.dest('dist'))
);

// 'gulp deploy' -- reads from your AWS Credentials file, creates the correct
// headers for your files and uploads them to S3
gulp.task('deploy', () => {
  // create a new publisher using S3 options
  // http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#constructor-property
  var credentials = {
    region: 'eu-west-1',
    params: {
      Bucket: 'southamerica.relations.consulting'
    },
    accessKeyId: process.env.S3_ACCESS_ID,
    secretAccessKey: process.env.S3_ACCESS_SECRET
  };
  var publisher = $.awspublish.create(credentials);

  var headers = {
    'Cache-Control': 'max-axe=315360000, no-transform, public'
  };

  gulp.src('dist/**/*')
    .pipe($.awspublish.gzip())
    .pipe(parallelize(publisher.publish(headers), 30))
    .pipe(publisher.cache())
    .pipe(publisher.sync())
    .pipe($.awspublish.reporter());
});

// 'gulp lint' -- check your JS for formatting errors using XO Space
gulp.task('lint', () =>
  gulp.src([
    'gulpfile.babel.js',
    'dist/assets/js/*.js',
    '!dist/assets/js/*.min.js'
  ])
  .pipe($.eslint())
  .pipe($.eslint.formatEach())
  .pipe($.eslint.failOnError())
);

// 'gulp serve' -- open up your website in your browser and watch for changes
// in all your files and update them when needed
gulp.task('watch', () => {
  $.livereload.listen();
  // Watch various files for changes and do the needful
  gulp.watch(['src/**/*.md', 'src/**/*.html', 'src/**/*.yml'], gulp.series('jekyll', 'assets:copy', 'html'));
  gulp.watch(['src/**/*.xml', 'src/**/*.txt'], gulp.series('jekyll', 'assets:copy'));
  gulp.watch('src/assets/javascript/**/*.js', gulp.series('scripts', 'assets:copy'));
  gulp.watch('src/assets/scss/**/*.scss', gulp.series('styles', 'assets:copy'));
  gulp.watch('src/assets/images/**/*', gulp.series('images', 'assets:copy'));
});

// 'gulp assets' -- cleans out your assets and rebuilds them
gulp.task('assets',
  gulp.parallel('styles', 'scripts', 'fonts', 'images')
);

// 'gulp assets:copy' -- copies the assets into the dist folder, needs to be
// done this way because Jekyll overwrites the whole folder otherwise
gulp.task('assets:copy', () =>
  gulp.src('dist/assets/**/*')
  .pipe(gulp.dest('dist/assets'))
);

// 'gulp build' -- same as above but with production settings
gulp.task('build', gulp.series(
  'jekyll', 'assets', 'inject:head', 'inject:footer', 'html'));

// 'gulp clean' -- erases your assets and gzipped files
gulp.task('clean', gulp.series('clean:dist', 'clean:metadata'));

// 'gulp rebuild' -- WARNING: Erases your assets and built site, use only when
// you need to do a complete rebuild
gulp.task('rebuild', gulp.series('clean', 'build'));

// 'gulp check' -- checks your Jekyll configuration for errors and lint your JS
gulp.task('check', gulp.series('jekyll:doctor', 'lint'));

// 'gulp' -- cleans your assets and gzipped files, creates your assets and
// injects them into the templates, then builds your site, copied the assets
// into their directory
gulp.task('default', gulp.series('rebuild'));
