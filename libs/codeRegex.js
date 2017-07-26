/**
 * Created by cuikai on 2015/9/16.
 * 本模块用于使用正则替换一些代码内容
 */


//下面是识别define("xxx",的
var reg_define = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(define)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\,/g;

//下面是识别注释的
var reg_comment = /(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))/g;

//下面是基于注释，识别@alia的
var reg_comment_alia = /(@(alia|alias)\s+)('[^']+'|"[^"]+"|[^\s;!@#%^&*()]+)/g;


//下面是识别require("xxx")的
var reg_require = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(require)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\)/g;

//下面是识别require.async("xxx",)
var reg_require_async = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(require.async)\s*\(\s*("(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*')\s*\,/g;
//下面是识别 require.async(["xxx","xxx"],的，先把require.async+数组部分弄出来
//array must be done for 2 step,first get the array with require.async, 2nd split the array
var reg_require_async_array = /"(?:[^\\"\r\n\f]|\\[\s\S])*"|'(?:[^\\'\n\r\f]|\\[\s\S])*'|(\/\/[^\r\n\f]+|\/\*[\s\S]*?(?:\*\/|$))|\b(require.async)\s*\(\s*\[.*\]/g;

//下面是识别数组的,[]之间的都会被识别
var reg_array =/\[.*\]/g;



exports.findAllDefines = function(content,foundCallback){
    return content.replace(reg_define,function(m, comment, type, value,firstPos,c) {
        if(type === 'define'){
            value = value.substr(1,value.length-2);//正则会把引号本身也传入进来，这里过滤掉
            foundCallback && foundCallback(value);
        }
        return m;
    });
}

/**
 * 从指定的content中，查找所有的同步依赖，并进行回调
 * @param content
 * @param foundCallback
 */
exports.findAllRequires = function(content,foundCallback){
    if(content){
        content.replace(reg_require, function (m, comment, type, value, firstPos, c) {
            //console.log(arguments);
            if(type ==='require'){
                value = value.substr(1,value.length-2);//正则会把引号本身也传入进来，这里过滤掉
                foundCallback && foundCallback(value);
            }
            return m;
        })
    }
}

exports.testFindAllRequires = function () {
    var content =
        //'/* this is a comment require("aaa")*/ \r\n'+
            'var m1 = require("../../a.js"); \r\n'+
            'var m2 = require("./b.js");'

    exports.findAllRequires(content, function (module) {
        console.log(module);
    })
};
//exports.testFindAllRequires();



exports.findAllAsyncRequires = function(content,foundCallback){
    if(content){
        //先处理单个的
        content= content.replace(reg_require_async, function (m, comment, type, value, firstPos, c) {
            if(type ==='require.async'){
                value = value.substr(1,value.length-2);//正则会把引号本身也传入进来，这里过滤掉
                foundCallback && foundCallback(value);
            }
            return m;
        });
        //再处理require.async([])的(多个依赖)
        content = content.replace(reg_require_async_array, function (m, comment, type, value, firstPos, c) {
            if(type ==='require.async'){
                m= m.replace(reg_array, function (arrayString) {
                    //对于[ "a1.js", "a2.js" ]这样的情况，必须取出中间部分，再trim
                    var moduleArray = arrayString.substr(1,arrayString.length-2).split(',');
                    for(var i=0,j=moduleArray.length;i<j;i++){
                        var _moduleName = moduleArray[i].trim();
                        _moduleName = _moduleName.substr(1,_moduleName.length-2);//去掉引号
                        foundCallback && foundCallback(_moduleName);
                    }
                });
            }
            return m;
        })
        return content;
    }
};

exports.testFindAllAsyncRequires = function () {
    var content =
        //'/* this is a comment require("aaa")*/ \r\n'+
        'var m1 = require.async("../../a.js",function(a){}); \r\n'+
        'var m2 = require.async(["./b.js","../../c1.js"],function(b,c1){});'

    exports.findAllAsyncRequires(content, function (module) {
        console.log(module);
    })
};
exports.testFindAllAsyncRequires();






/**
 *  替换输入content(js代码)要异步require的组件id(注意这里不处理require.async多个的情况)
 * @param content:要替换的js代码
 * @param replaceFunc：替换函数 function(moduleId){return "new_module_Id"}.该函数的返回值，会替换moduleId的取值
 * @returns {string}：返回完成替换后的整个js文本
 */
exports.replaceRequireAsync = function (content, replaceFunc) {
    if(content){
        //先处理单个的
        content= content.replace(reg_require_async, function (m, comment, type, value, firstPos, c) {
            if(type ==='require.async'){
                value = value.substr(1,value.length-2);//正则会把引号本身也传入进来，这里过滤掉
                value = replaceFunc(value);
                return 'require.async("'+value+'",';//替换回原来的文本
            }else{
                return m;
            }
        });
        //再处理require.async([])的(多个依赖)
        content = content.replace(reg_require_async_array, function (m, comment, type, value, firstPos, c) {
            if(type ==='require.async'){
                m= m.replace(reg_array, function (arrayString) {
                    //对于[ "a1.js", "a2.js" ]这样的情况，必须取出中间部分，再trim
                    var moduleArray = arrayString.substr(1,arrayString.length-2).split(',');
                    for(var i=0,j=moduleArray.length;i<j;i++){
                        var _moduleName = moduleArray[i].trim();
                        _moduleName = _moduleName.substr(1,_moduleName.length-2);//去掉引号
                        _moduleName = replaceFunc(_moduleName); //调用外部方法替换moduleName
                        moduleArray[i] = "'"+_moduleName+"'"; //再回写moduleName
                    }
                    return '['+moduleArray.join(",").toString()+']';
                });
            }
            return m;
        })
        return content;

    }else{
        return "";
    }
}


/**
 *  替换输入content(js代码)的require的组件id
 * @param content:要替换的js代码
 * @param replaceFunc：替换函数 function(moduleId){return "new_module_Id"}.该函数的返回值，会替换moduleId的取值
 * @returns {string}：返回完成替换后的整个js文本
 */
exports.replaceRequire = function (content, replaceFunc) {
    if(content){
        return content.replace(reg_require, function (m, comment, type, value, firstPos, c) {
            if(type ==='require'){
                value = value.substr(1,value.length-2);//正则会把引号本身也传入进来，这里过滤掉
                value = replaceFunc(value);
                return 'require("'+value+'")';//替换回原来的文本
            }else{
                return m;
            }
        })
    }else{
        return "";
    }
}

/**
 *
 * 对传入的js文本内容进行define("xxxx",的替换
 * @param content：要替换的js内容
 * @param moduleId：要替换define内部模块名为xxx
 * @returns {*}:返回替换后的文本
 */
exports.replaceDefineWith = function(content,moduleId){
    return content.replace(reg_define,function(m, comment, type, value,firstPos,c) {
        if(type === 'define'){
            //填充类似这样一段：define("moduleId",
            return 'define("'+moduleId+'",'
        }else{
            return m;
        }
    });
}

/**
 *
 * 获取文本里定义的alia(注意，如果一个文件声明多次，则以第一次为准)
 * @param jsContent:代码文件内容
 * @returns {boolean|String}：如果没有定义alia,则返回false . 如果定义了alia,则返回alia
 */
exports.getAlia = function (jsContent) {

    var alia = false;
    jsContent && jsContent.replace(reg_comment, function (m, comment) {
       if(comment){
           comment.replace(reg_comment_alia, function (m, prefix, type, value) {
               //console.log(arguments);
               if(type === 'alia' && alia === false){
                   //确实定义了别名，则返回别名
                   alia = value;
                   return;
               }
           })
       }
    });
    return alia;
};


exports.testReplaceRequireAsync = function () {

    var content =
        'var a = require.async("../X5"){' +//这一行不会标题替换，因为不是,结尾
        'var a = require.async(\'../X522\',function(require,exports){' +
        'var a = require.async([  \'../../a.js\',  "../../a22.js"  ])'

    content=exports.replaceRequireAsync(content, function (module) {
        return module+"*"
    });

    console.log("after replace ,content is:%s",content);
}
//exports.testReplaceRequireAsync();

exports.testReplaceRequire = function () {

    var content =
        '// var asss = require("../X25"){ \r\n' +
        'var a = require("../X5"){' +
        'var a = require(\'../X522\',function(require,exports){' +
        'var a = require([\'../../a.js\',"../../a22.js"])'

    content=exports.replaceRequire(content, function (module) {
        return module+"*"
    });

    console.log("after replace ,content is:%s",content);
}
//exports.testReplaceRequire();

exports.testReplaceDefine = function () {

    var content =
        'var a = define("../X5",function(require,exports){' +
        'var a = define(\'../X522\',function(require,exports){' +
        'var a = require([\'../../a.js\',"../../a22.js"])'
    '})'

    content=exports.replaceDefineWith(content,"M1");

    console.log("after replace ,content is:%s",content);
}
exports.testAlia = function () {
    var content =
        '//@require list.js \r\n'+
        '//@alia X2.CC \r\n'+ //这种写法生效
        '//@alia    X22 \r\n'+
        '//@alia("X3") \r\n'+
        '//@alias(\'X4\') \r\n'+
        '/*__inline(\'IX4\') \r\n'+
        'define("X5",function(require,exports){' +
        '})*/'

    console.log("getAlia=",exports.getAlia(content)); //getAlia= X2.CC
}


//exports.testReplaceDefine();