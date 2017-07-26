/**
 * Created by cuikai on 2015/9/12.
 * 主要处理html,jss直接的依赖关系的工具函数
 */

var fs = require('fs'),
    pth = require('path'),
    _exists = fs.existsSync || pth.existsSync;

var arrayUtil = require("./arrayUtil.js"),
    codeRegex = require("./codeRegex.js");

_=module.exports;

/**
 * 根据输入的模块id,和模块字典，递归计算模块依赖的其他模块
 * @param moduleId:依赖的模块id
 * @param moduleMap:整个模块表
 * @param key:模块表中，表示依赖的类型
 * @return:返回的是去重后的依赖链条，按照依赖先后从0到length-1
 */
_.getModuleDependencyByMap = function(moduleId,moduleMap,key){
    var depends=[];//输出的依赖项，按照最远到最近的方式输出
    //否则，查询srcMap,计算他的子依赖，加上自己返回
    var _src =moduleMap[moduleId];
    if(_src){
        for(var i=0,j=_src[key].length;i<j;i++){
            var d = _src[key][i];
            depends = depends.concat(_.getModuleDependencyByMap(d,moduleMap,key));
        }
        //自己加进去、去重
        depends.push(moduleId);
        //depends.push(_src.uri);
        arrayUtil.removeArrayDump(depends,false);
        //arrayUtil.removeArrayDump(depends,true);
        return depends;
    }else{
        throw new Error('module:['+moduleId+'] must config in moduleMap!')
    }
}

/**
 * 获取输入的模块的所有依赖(同步、异步),组织成数组返回
 * @param moduleId
 * @param moduleMap
 * @returns {Array}
 */
_.getModuleAllDependencyByMap = function(moduleId,moduleMap){
    var depends=[];//输出的依赖项，按照最远到最近的方式输出
    //否则，查询srcMap,计算他的子依赖，加上自己返回
    var _src =moduleMap[moduleId];
    if(_src){
        for(var i=0,j=_src["deps"].length;i<j;i++){
            var d = _src["deps"][i];
            depends = depends.concat(_.getModuleAllDependencyByMap(d,moduleMap));
        }

        for(var i=0,j=_src["asyncUse"].length;i<j;i++){
            var d = _src["asyncUse"][i];
            depends = depends.concat(_.getModuleAllDependencyByMap(d,moduleMap));
        }
        //自己加进去、去重
        depends.push(moduleId);
        //depends.push(_src.uri);
        arrayUtil.removeArrayDump(depends,false);
        return depends;
    }else{
        throw new Error('module:['+moduleId+'] must config in moduleMap!')
    }
}



/**
 * 获取html页面里，引用的css脚本，按照从上倒下的顺序调用回调函数
 * @param htmlJQueryObject：页面文档的JQuery对象
 * @param eachFunc:回调函数，接受一个参数是css的JQuery对象
 */
_.forCssObjectInHtml = function(htmlJQueryObject,eachFunc){
    var $ = htmlJQueryObject;
    var script =$('link[rel="stylesheet"]');
    for(var i=0,j=script.length;i<j;i++) {
        eachFunc && eachFunc($(script[i]))
    }
};

/**
 * 获取html页面里，引用的js脚本，按照从上倒下的顺序调用回调函数
 * @param htmlJQueryObject：页面文档的JQuery对象
 * @param eachFunc:回调函数，接受一个参数是script的JQuery对象
 */
_.forScriptsObjectInHtml = function(htmlJQueryObject,eachFunc){
    var $ = htmlJQueryObject;

    var script =$('script[type="text/javascript"]');
    for(var i=0,j=script.length;i<j;i++) {
        eachFunc && eachFunc($(script[i]))
    }
};


/**
 * 获取html页面里，定义的内联js脚本，按照从上倒下的顺序调用回调函数
 * @param htmlJQueryObject：页面文档的JQuery对象
 * @param eachFunc:回调函数，接受一个参数是script的内容
 */
_.forInlineScriptsContentInHtml = function(htmlJQueryObject,eachFunc){
    var $ = htmlJQueryObject;

    var script =$('script[type="text/javascript"]');
    for(var i=0,j=script.length;i<j;i++) {
        var _item = $(script[i]);
        if(!_item.attr("src")){
            eachFunc && eachFunc(_item.html())
        }
    }
};


/**
 * 修改 html页面里，定义的内联js脚本，（按照从上倒下的顺序调用回调函数）
 * @param htmlJQueryObject：页面文档的JQuery对象
 * @param eachFunc:回调函数，接受一个参数是script的内容,函数的返回值会被替换js脚本内容。返回为空，则表示不替换
 */
_.updateInlineScriptsContentInHtml = function(htmlJQueryObject,eachFunc){
    var $ = htmlJQueryObject;

    var script =$('script[type="text/javascript"]');
    for(var i=0,j=script.length;i<j;i++) {
        var _item = $(script[i]);
        if(!_item.attr("src")){
            var modify;
            eachFunc && ( modify = eachFunc(_item.html()))
            modify && _item.html(modify)
        }
    }
};