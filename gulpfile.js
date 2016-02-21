var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var bowerFiles = require('main-bower-files');
var browserSync = require('browser-sync');
var del = require('del');
var es = require('event-stream');

var useJade = false;

var log = function (error) {
    console.log([
        '',
        "----------ERROR MESSAGE START----------",
        ("[" + error.name + " in " + error.plugin + "]"),
        error.message,
        "----------ERROR MESSAGE END----------",
        ''
    ].join('\n'));
    this.end();
};


var paths = {
    scripts: 'app/**/*.js', //js
    styles: ['./app/scss/**/*.css', './app/scss/**/*.scss'], //css
    images: 'app/img/**/*', //images
    index: 'app/index.html', //
    indexJade: 'app/index.jade', //path for our index.jade
    partials: ['app/**/*.html', '!app/index.html'],
    partialsJade: ['app/**/*.jade', '!app/index.jade'],
    distDev: 'dist.dev',
    distProd: 'dist.prod',
    distDevCss: 'dist.dev/css',
    distProdCss: 'dist.prod/css',
    distDevImg: 'dist.dev/img',
    distProdImg: 'dist.prod/img',
    distScriptsProd: 'dist.prod/scripts'
};

var pipes = {};

//jquery和angular的先后顺序
pipes.orderedVendorScripts = function(){
    return plugins.order(['jquery.js'],['angular.js']);
};

//检查JS文件
pipes.validatedAppScritps = function(){
    return gulp.src(paths.scripts)
        .pipe(plugins.jshint())
        .pipe(plugins.jshint.reporter('jshint-stylish'))
};

//构建index
pipes.buildIndexFile = function(){
    if (useJade){
        return gulp.src(paths.indexJade)
            .pipe(plugins.plumber({
                errorHandler:function(error){
                    console.log(error.message);
                    this.emit('end')
                }
            }))
            .pipe(plugins.jade())
            .pipe(plugins.prettify({indent_size:2}))
    }else{
        return gulp.src(paths.index)
    }
};

//构建bower目录下的JS
pipes.builtVendorScriptsDev = function() {
    return gulp.src(bowerFiles())
        .pipe(gulp.dest(paths.distDev + '/vendor'));
};

//构建JS
pipes.builtAppScriptsDev = function(){
    return pipes.validatedAppScritps()
        .pipe(plugins.ngAnnotate())
        .pipe(plugins.concat('app.js'))
        .pipe(gulp.dest(paths.distDev))
};

//构建HTML OR JADE 除了INDEX
pipes.builtPartialsFilesDev = function() {
    if (useJade) {
        return gulp.src(paths.partialsJade)
            .pipe(plugins.plumber())
            .pipe(plugins.jade())
            .pipe(plugins.prettify({indent_size: 2}))
            .pipe(gulp.dest(paths.distDev));
    } else {
        return gulp.src(paths.partials)
            .pipe(plugins.htmlhint({'doctype-first': false}))
            .pipe(plugins.htmlhint.reporter())
            .pipe(gulp.dest(paths.distDev));
    }
};

// 构建CSS/SASS
pipes.builtStylesDev = function() {
    return gulp.src(paths.styles)
        .pipe(plugins.plumber({
            errorHandler: function (error) {
                console.log(error.message);
                this.emit('end');
            }}))
        .pipe(plugins.sass())
        .pipe(plugins.cssUrlAdjuster({
            replace:  ['../../app/img','../img/'] //When we use sprite we have wrong path for our sprite, this is fixed
        }))
        .pipe(gulp.dest(paths.distDevCss));
};


// 构建图片
pipes.processedImagesDev = function() {
    return gulp.src(paths.images)
        .pipe(gulp.dest(paths.distDevImg));
};


// 构建所有
pipes.builtIndexDev = function() {
    var orderedVendorScripts = pipes.builtVendorScriptsDev()
        .pipe(pipes.orderedVendorScripts());
    var orderedAppScripts = pipes.builtAppScriptsDev();
    var appStyles = pipes.builtStylesDev();
    return pipes.buildIndexFile()
        .pipe(gulp.dest(paths.distDev))
        .pipe(plugins.inject(orderedVendorScripts, {relative: true,name: 'bower'}))
        .pipe(plugins.inject(orderedAppScripts, {relative: true}))
        .pipe(plugins.inject(appStyles, {relative: true}))
        .pipe(gulp.dest(paths.distDev));
};
// 构建
pipes.builtAppDev = function() {
    return es.merge(pipes.builtIndexDev(), pipes.builtPartialsFilesDev(), pipes.processedImagesDev());
};

/* = = =
 |
 | TASK
 |
 = = = */
/* = = =
 | DEV TASKS
 = = = */
// 删除编译的文件
gulp.task('clean-dev', function() {
    return del(paths.distDev);
});
// 构建任务
gulp.task('build-app-dev', pipes.builtAppDev);
// 构建之前删除原来编译过的文件
gulp.task('clean-build-app-dev', ['clean-dev'], pipes.builtAppDev);
// 开启任务
gulp.task('watch-dev', ['clean-build-app-dev'], function() {
    var indexPath;
    var partialsPath;
    var reload = browserSync.reload;

    if (useJade) {
        indexPath = paths.indexJade;
        partialsPath = paths.partialsJade;
    } else {
        indexPath = paths.index;
        partialsPath = paths.partials;
    }
    // start browser-sync to auto-reload the dev server
    browserSync({
        port: 8000,
        server: {
            baseDir: paths.distDev
        }
    });

    // watch index
    gulp.watch(indexPath, function() {
        return pipes.builtIndexDev()
            .pipe(reload({stream: true}));
    });

    // watch app scripts
    gulp.watch(paths.scripts, function() {
        return pipes.builtAppScriptsDev()
            .pipe(reload({stream: true}));
    });

    // watch html partials
    gulp.watch(partialsPath, function() {
        return pipes.builtPartialsFilesDev()
            .pipe(reload({stream: true}));

    });

    // watch styles
    gulp.watch(paths.styles, function() {
        return pipes.builtStylesDev()
            .pipe(reload({stream: true}));
    });

    // watch images
    gulp.watch(paths.images, function() {
        return pipes.processedImagesDev()
            .pipe(reload({stream: true}));
    });

});