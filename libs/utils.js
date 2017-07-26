/**
 * Created by cuikai on 2015/9/12.
 */
var fs = require('fs'),
    pth = require('path'),
    _exists = fs.existsSync || pth.existsSync;

var IS_WIN = process.platform.indexOf('win') === 0;
var _=module.exports;
/**
 * 是否为一个文件
 * @param  {String}  path 路径
 * @return {Boolean}      true为是
 * @memberOf fis.util
 * @name isFile
 * @function
 */
_.isFile = function(path) {
    return _exists(path) && fs.statSync(path).isFile();
};

/**
 * 返回path的绝对路径，若path不存在则返回false
 * @param  {String} path 路径
 * @return {String}      绝对路径
 * @memberOf fis.util
 * @name realpath
 * @function
 */
_.realpath = function(path) {
    if (path && _exists(path)) {
        path = fs.realpathSync(path);
        if (IS_WIN) {
            path = path.replace(/\\/g, '/');
        }
        if (path !== '/') {
            path = path.replace(/\/$/, '');
        }
        return path;
    } else {
        return false;
    }
};

/**
 * 是否为文件夹
 * @param  {String}  path 路径
 * @return {Boolean}      true为是
 * @memberOf fis.util
 * @name isDir
 * @function
 */
_.isDir = function(path) {
    return _exists(path) && fs.statSync(path).isDirectory();
};

/**
 * 把from对象里的属性，复制到to里
 * @param from
 * @param to
 * @param overWritten：如果为true,那么from会覆盖to里的同名属性
 */
_.merge = function (from,to,overWritten) {
    overWritten = overWritten||false;//默认不覆盖
    for(var i in from){
        if(to.hasOwnProperty(i)){
            overWritten && (to[i] = from[i])
        }else{
            to[i] = from[i]
        }
    }
}