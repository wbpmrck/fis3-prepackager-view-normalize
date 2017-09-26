/**
 * Created by cuikai on 2015/9/11.
 * 在fis3的postprocessor阶段：
 * 1、对文件里使用component的地方进行处理
 * 2、后续可能会支持对require的处理（添加依赖项)
 */



var cheerio = require('cheerio'),
    utils = require("./libs/utils.js");

var utilNode = require("util");
var fs = require('fs'),
    pth = require('path'),
    _exists = fs.existsSync || pth.existsSync;

var dependencyUtil = require("./libs/dependency.js");
var arrayUtil = require("./libs/arrayUtil.js");
var codeRegex = require("./libs/codeRegex.js");


/**
 * 在生产环境下，需要清理js标签上不必要的属性
 * @param htmlJqueryObj
 * @param settings
 */
function clearOtherProperties(htmlJqueryObj,settings){
    var $ = htmlJqueryObj;
    dependencyUtil.forScriptsObjectInHtml($, function (item) {
        item.removeAttr("jspath").removeAttr("from").removeAttr("depby").removeAttr("moduleid");

    })
}

/**
 * 根据传入的proxy(srcMap),替换内容中有SRC_MAP的地方，替换失败返回false
 * @param content
 * @param settings
 * @param proxy
 * @returns {*}
 */
function replaceSrcMap(content,settings,proxy){
    var replaced=false;
    content=content.replace(/\b_SRC_MAP_\b/g, function () {
        replaced = true;
        return JSON.stringify(proxy,null,4);
    });
    return replaced?content:false;
}

//给界面上所有脚本添加换行
function setScriptSpaceLine(htmlJqueryObj,settings){
    var $ = htmlJqueryObj;

    dependencyUtil.forScriptsObjectInHtml($, function (script) {
        script.before('\r\n');
    });
    dependencyUtil.forCssObjectInHtml($, function (script) {
        script.before('\r\n');
    });
}
/**
 * 移除页面上重复的脚本
 * @param htmlJqueryObj
 * @param settings
 */
function removeDumpScripts(htmlJqueryObj,settings){
    var $ = htmlJqueryObj;

    var dic={};
    var moduleDic={};
    //获取页面上所有的脚本,进行删除标记

    dependencyUtil.forScriptsObjectInHtml($, function (_scriptItem) {
        //先判断moduleId
        if(_scriptItem.attr("moduleId")){

            if(moduleDic.hasOwnProperty(_scriptItem.attr("moduleId"))){
                _scriptItem.attr("_remove","true");
            }else{
                moduleDic[_scriptItem.attr("moduleId")] = true;
            }
        }
        //对于内联脚本，判断其是否重复
        else if(!_scriptItem.attr("src")){
            //判断内容 =。=
            if(dic.hasOwnProperty(_scriptItem.toString())){
                _scriptItem.attr("_remove","true");
                //_scriptItem.remove();
            }else{
                dic[_scriptItem.toString()] = true;
            }
        }else{
            //判断外部脚本是否重复，根据src即可
            if(dic.hasOwnProperty(_scriptItem.attr("src"))){
                _scriptItem.attr("_remove","true");
                //_scriptItem.remove();
            }else{
                dic[_scriptItem.attr("src")] = true;
            }
        }
    });

    $('script[_remove="true"]').remove();
}
/**
 * 把页面上的脚本进行置底
 * @param htmlJqueryObj
 * @param settings
 */
function moveScriptBottom(htmlJqueryObj,settings){

    var $ = htmlJqueryObj;
    //获取页面上所有的脚本
    var script =$('script[type="text/javascript"]');

    //确定插入点，如果setting有传入id,则使用对应id的dom节点，如果没有，则在body结束之前插入
    if(settings.hasOwnProperty("jsPlaceholderID") && $("#"+settings.jsPlaceholderID).length>0){
        script.insertBefore("#"+settings.jsPlaceholderID);
        //移除placeholder
        $("#"+settings.jsPlaceholderID).remove();
    }else{
        $("body").append(script);
    }
}
/**
 * 把页面上的样式表置顶
 * @param htmlJqueryObj
 * @param settings
 */
function moveCssTop(htmlJqueryObj,settings){
    var $ = htmlJqueryObj;
    //获取页面上所有的脚本
    var script =$('link[rel="stylesheet"]');

    //确定插入点，如果setting有传入id,则使用对应id的dom节点，如果没有，则在 head 结束之前插入
    if(settings.hasOwnProperty("cssPlaceholderID") && $("#"+settings.cssPlaceholderID).length>0){
        script.insertBefore("#"+settings.cssPlaceholderID);
        //移除placeholder
        $("#"+settings.cssPlaceholderID).remove();
    }else{
        $("head").append(script);
    }

}


/**
 * 给页面添加srcMap设置脚本
 * @param htmlJqueryObj
 * @param settings
 * @param getSrcFunc:这个函数接受一个参数是moduleId,返回module的发布地址
 * @param srcMap:这是配置OneLib.CMDSyntax.setSrcMap的 数据对象，如果传入，则插入在其他脚本之前（则表示该脚本由构建工具自动插入）
 *                      当然，也可以由开发人员自己用占位符 _SRC_MAP_ 来自定插入位置
 */
function addSrcMapScript(htmlJqueryObj,settings,srcMap){

    var $ = htmlJqueryObj;
    //获取页面上的通用脚本插入后的占位符
    var firstScript =$('script[isfirstbizscript=true]');

    //如果需要构建工具自动插入srcMap脚本
    if(srcMap){
        var _srcMapLink = $('<script type="text/javascript"/>');
        _srcMapLink.html("\r\n      OneLib.CMDSyntax.setSrcMap("+JSON.stringify(srcMap,null,4)+");\r\n");
        _srcMapLink.insertBefore(firstScript);
    }
}

var defaultSettings={
    //动态生成正则比较麻烦，这次写死
    //srcMapPlaceholderID:"_SRC_MAP_", //需要替换为调用 OneLib.CMDSyntax.setSrcMap 的占位符(插件会在占位符处替换为json的srcMap)
   
    cssPlaceholderID:"default", //默认：在head结尾之前
    jsPlaceholderID:"default" //默认：在body结尾之前
};

var contextData ={};//存放 前阶段，fis插件写入fis的数据
/*
    格式：
 "libs/jquery-1.8.1/jquery.min.js":{
    uri:"http://static.local.com/static/libs/jquery-1.8.1/jquery.min.js",
    deps:[] //无依赖的情况
 },
 "testWeb/debug-1.0/bar/bar.js":{
    uri:"http://static.local.com/static/c/testWeb/debug-1.0/bar/bar.js",
    deps:[
    "libs/jquery-1.8.1/jquery.min.js",
    "testWeb/debug-1.0/foo/foo.js" //多个依赖的情况
    ]
 },
 "testWeb/debug-1.0/foo/foo.js":{
     uri:"http://static.local.com/static/c/testWeb/debug-1.0/foo/foo.js",
     deps:[
     "libs/jquery-1.8.1/jquery.min.js"
     ]
 }
 */


/**
 * 之所以用全名，是因为subPath很多时候不好约定格式，特别是首个/
 * @param subpath
 * @returns {*}
 */
function getModuleIdWithFullPath(fullpath){

    return contextData.pathToModuleId[fullpath];
    //for(var m in contextData.allModules){
    //    if(contextData.allModules[m].fullname = fullpath){
    //        return m
    //    }
    //}
}



function _getModuleFile(moduleId){
    return contextData.allModulesFile[moduleId];
}
function _getModuleInfo(moduleId){
    return contextData.allModules[moduleId];
}
function _getModuleAlia(moduleId){
    return contextData.pathToAlias[moduleId];
}

/**
 * 通过模块名或alia,获取模块在发布时候的moduleId
 * 2015-09-28：这里倾向于使用alia，而不是moduleId,是因为前端loader并没有所有moduleId的信息，他只关注alia
 * @param moduleIdOrAlia
 * @returns {*}
 * @private
 */
function _getModuleId(moduleIdOrAlia){
    ////查询别名表
    if(contextData.allAlias.hasOwnProperty(moduleIdOrAlia)){
        moduleIdOrAlia = moduleIdOrAlia;
    }else if(contextData.pathToAlias.hasOwnProperty(moduleIdOrAlia)){
        moduleIdOrAlia = contextData.pathToAlias[moduleIdOrAlia];
    }else{
        //没有别名，则查询模块信息表，有的话直接返回，否则报错
        if(!contextData.allModules.hasOwnProperty(moduleIdOrAlia)){
            throw new Error("getDependencyModuleId error:module ["+moduleIdOrAlia+'] not exist!')
        }
    }
    return moduleIdOrAlia;
}

//通过模块id,获取模块的发布地址
function _getModuleReleasePath(moduleId){
    console.log("_getModuleReleasePath:"+moduleId);
    var mFile = _getModuleFile(moduleId);
    return mFile.getUrl();
    ////如果配置了域名
    //if(mFile.domain){
    //    return mFile.domain+mFile.url
    //}else{
    //    return mFile.url
    //}
}

/**
 * 打包阶段插件接口
 * @param  {Object} ret      一个包含处理后源码的结构
 *
 // ret.src 所有的源码，结构是 {'<subpath>': <File 对象>}
 // ret.ids 所有源码列表，结构是 {'<id>': <File 对象>}
 // ret.map 如果是 spriter、postpackager 这时候已经能得到打包结果了，
 //         可以修改静态资源列表或者其他
 * @param  {Object} conf     一般不需要关心，自动打包配置文件
 * @param  {Object} settings 插件配置属性
 * @param  {Object} opt      命令行参数
 * @return {undefined}
 */
module.exports = function (ret, conf, settings, opt) {
    //对配置项做填充
    utils.merge(defaultSettings,settings,false);

    /*
     {
         alias:allAlias,
         moduleHaveAlias:allModuleHaveAlias,
         allModules:allModules
     }
     */
    contextData=fis._ckdata;

    //console.log(JSON.stringify(contextData.pathToModuleId,null,4));

    var c = 0;
    for(var subpath in ret.src) {
        c++;
        var file = ret.src[subpath];
        //只对我们标注了views属性的文件进行处理
        if (file.isViews) {

            // 只对 html 类文件进行处理
            if (!file.isHtmlLike) {
                console.log('不是 htmlFile:file:'+subpath);
                continue;
            }
            else{

                console.log('normalize:file:'+file.subpath);

                var content = file.getContent();
                var $ = cheerio.load(content,{decodeEntities: false});
                    //viewSrcMap={};

                /*
                分析页面上用到的所有依赖
                1、看html 直接引用了哪些脚本，这些脚本叫做【根】，分析根脚本内容的define,获取脚本的moduleName(因为可能是alia,所以要查询
                 contextData.alias 获取moduleId)
                2、获取【根】的递归依赖链条：
                    根据contextData.allModules里的deps和asyncUse信息，把【跟】脚本的依赖链条递归获取出来
                3、把每个根的同步依赖，插入到页面上
                4、把所有根要用到的模块信息，替换到占位符上
                 */
                //先获取界面上有哪些嵌入、外链的js脚本模块
                var rootModuleDeps ={}; //key:moduleId  value:dependency array
                var inlinceRootModules ={}; //key:moduleId  这个字典保存页面上内嵌的根模块，因为这些模块无需再嵌入页面了
                var rootModuleUses =[]; //所有用到的异步依赖(2015-09-23：以及这些异步依赖可能用到的同步和异步依赖)

                dependencyUtil.forScriptsObjectInHtml($, function (_scriptItem) {
                    if (!_scriptItem.attr("src")) {
                        console.log('根节点获取：准备分析html文件:['+file.subpath+']中的内联脚本的moduleId)');

                        codeRegex.findAllDefines(_scriptItem.html(), function (hostModuleId) {
                            //给脚本加上moduleId标签
                            _scriptItem.attr("moduleId",hostModuleId);
                            if(!rootModuleDeps.hasOwnProperty(hostModuleId)){
                                rootModuleDeps[hostModuleId] = [];//初始化空的依赖数组
                                inlinceRootModules[hostModuleId] = true;//放入内联根模块字典
                            }else{
                                throw new Error('在文件:['+file.subpath+']的内联js中出现多次define 同一个module '+hostModuleId+ '的情况！,请检查！')
                            }
                        });

                    }else{
                        //外链的js脚本，需要获取到文件内容
                        var fullpath = _scriptItem.attr('jspath');
                        console.log('根节点获取：准备获取html文件:['+file.subpath+'] 引用的脚本:['+fullpath+'] 的moduleId)');
                        var hostModuleId = getModuleIdWithFullPath(fullpath.replace(/\\/g, "/"));
                        //由于分析出来的moduleId可能是一个subpath,也可能是alia,需要转化为当前统一的格式(优先使用alia)
                        hostModuleId = _getModuleId(hostModuleId);
                        //给脚本加上moduleId标签
                        _scriptItem.attr("moduleId",hostModuleId);
                        if(!rootModuleDeps.hasOwnProperty(hostModuleId)){
                            rootModuleDeps[hostModuleId] = [];//初始化空的依赖数组
                        }else{
                            throw new Error('在文件:['+file.subpath+']的外链js中出现多次define 同一个module:'+hostModuleId+' 的情况！,请检查！')
                        }
                    }
                });


                console.log('准备分析root模块的同步依赖：');

                //helper方法，判断一个模块是否已经被同步引用了
                function _moduleAllreadyDeps(moduleId){
                    for(var o in rootModuleDeps){
                        var _root = rootModuleDeps[o];
                        if(moduleId == _root){
                            return true;
                        }else{
                            for(var q=0,r=_root.length;q<r;q++){
                                var depModule = _root[q];
                                if(moduleId == depModule){
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                }

                //helper 方法，判断一个模块是否被异步使用
                function _moduleAllreadyAsyncUse(moduleId){
                    for(var m=0,n=rootModuleUses.length;m<n;m++){
                        var depModule = rootModuleUses[m];
                        if(moduleId == depModule){
                            return true;
                        }

                    }
                    return false;
                }

                //开始分析页面依赖的这些模块，都有哪些同步的其他依赖项
                for(m in rootModuleDeps){
                    rootModuleDeps[m] = dependencyUtil.getModuleDependencyByMap(m,contextData.allModules,'deps');
                }

                //console.log('root模块的同步依赖：'+utilNode.inspect(rootModuleDeps));
                //console.log('root模块的内联模块：'+utilNode.inspect(inlinceRootModules));



                console.log('准备分析root模块,以及他的同步依赖，使用的异步依赖');

                for(m in rootModuleDeps){
                    var muses = dependencyUtil.getModuleAllDependencyByMap(m,contextData.allModules);
                    muses.splice(muses.length-1);//对于异步依赖，无需传入m自己
                    rootModuleUses = rootModuleUses.concat(muses);
                    //加上其他依赖的异步依赖
                    for(var other in rootModuleDeps[m]){
                        var otherUses = dependencyUtil.getModuleAllDependencyByMap(rootModuleDeps[m][other],contextData.allModules);
                        otherUses.splice(otherUses.length-1);//对于异步依赖，无需传入m自己
                        rootModuleUses = rootModuleUses.concat(otherUses);
                    }
                }

                //数组去重
                arrayUtil.removeArrayDump(rootModuleUses,false);
                //console.log('root模块所有可能 异步使用的模块如下：\r\n'+utilNode.inspect(rootModuleUses));
                console.log('先取出页面上的所有外联、inline的root模块：\r\n');

                var rootScripts = $('script[type="text/javascript"]');
                for(var i=0,j=rootScripts.length;i<j;i++){
                    var _item = $(rootScripts[i]);
                    if(!_item.attr("predefined")){
                        _item.remove();
                    }

                }
                //rootScripts.remove('');

                //对于同步依赖，需要直接嵌入脚本到页面上，注意先后关系
                //注意：已经在页面内联的模块，就无需嵌入了
                //每一个根单独嵌入
                for(var root in rootModuleDeps){
                    var rootdeps = rootModuleDeps[root];

                    for(var i=0,j=rootdeps.length;i<j;i++){
                        var _item = rootdeps[i];
                        //先插入依赖，最后插入root(deps里面最后一个就是root自己)
                        console.log('准备分析:[%s]',_item)

                        //如果不在根里，说明是引用外部的脚本，作为外链脚本插入即可
                        if(!rootModuleDeps.hasOwnProperty(_item)){
                            var jsRef = _getModuleReleasePath(_item);
                            var _jsLink = $('<script type="text/javascript"/>');
                            _jsLink.attr("depBy",root); //冗余一个字段：被依赖的模块
                            _jsLink.attr('src',jsRef);
                            _jsLink.attr('moduleId',_item);

                            console.log('创建并嵌入新的外链嵌入脚本:[%s]',_item)

                            $('body').append(_jsLink);
                        }else{
                            //已经在页面根里的的模块，就从页面的根信息里取脚本数据（如果有内联的文本在根里，无法生造）
                            console.log('从root脚本缓存中导入:[%s]',_item);
                            var cached = rootScripts.filter(function(i, el) {
                                return $(this).attr('moduleId') === _item;
                            });
                            if(cached.attr("predefined")){
                                console.log("moduleId "+_item+"属于预置模块，不进行脚本位置调整处理");
                                continue;
                            }
                            if(cached.length<1){
                                throw new Error("缓存中没有找到符合选择器:"+'script[moduleId="'+_item+'"]'+"的脚本")
                            }else{
                                $('body').append(cached);
                            }
                        }

                    }

                }

                //把页面上的脚本进行置底（先按照依赖关系排序）
                moveScriptBottom($,settings);

                //把一部分数据代理出来，序列化使用
                var proxy = {};

                //2015-10-15，改为从uses里取，不需要遍历所有modules
                //只要异步依赖、且本地依赖中没有的就够了（因为本地有了，可以从本地直接load,无需注册到srcMap），
                for(var o=0,p=rootModuleUses.length;o<p;o++){
                    var m = rootModuleUses[o];
                    if(!_moduleAllreadyDeps(m) ){
                        //if(_moduleAllreadyAsyncUse(m)){

                        var data = {
                            uri:_getModuleReleasePath(m),
                            //对依赖的模块名也进行别名检查，替换
                            deps:contextData.allModules[m].deps.map(function (d) {
                                var _d;
                                return (_d= _getModuleAlia(d))?_d:d
                            }),
                            asyncUse:contextData.allModules[m].asyncUse.length>0?contextData.allModules[m].asyncUse:undefined
                        };
                        //使用别名代替模块ID
                        var alia = _getModuleAlia(m);
                        if(alia){
                            m = alia;
                        }
                        proxy[m]=data;
                    }
                }

                //for(var m in contextData.allModules){
                //    //只要异步依赖、且本地依赖中没有的就够了（因为本地有了，可以从本地直接load,无需注册到srcMap），
                //
                //    if(_moduleAllreadyAsyncUse(m)&& !_moduleAllreadyDeps(m) ){
                //    //if(_moduleAllreadyAsyncUse(m)){
                //
                //        var data = {
                //            uri:_getModuleReleasePath(m),
                //            //对依赖的模块名也进行别名检查，替换
                //            deps:contextData.allModules[m].deps.map(function (d) {
                //                var _d;
                //                return (_d= _getModuleAlia(d))?_d:d
                //            }),
                //            asyncUse:contextData.allModules[m].asyncUse.length>0?contextData.allModules[m].asyncUse:undefined
                //        };
                //        //使用别名代替模块ID
                //        var alia = _getModuleAlia(m);
                //        if(alia){
                //            m = alia;
                //        }
                //        proxy[m]=data;
                //    }
                //}


                console.log('移除页面上重复的脚本：\r\n');
                //移除页面上重复的脚本
                removeDumpScripts($,settings);


                console.log('把页面上的样式表置顶：\r\n');
                //把页面上的样式表置顶
                moveCssTop($,settings);

                console.log('增加脚本换行：\r\n');
                setScriptSpaceLine($,settings);

                //将上述所有步骤操作结果写回
                file.setContent($.html());





                content = file.getContent();
                $ = cheerio.load(content);
                //判断如果有需要设置的srcMap,检查设置方式：
                var proxy_has_keys = 0;
                for(var k in proxy){
                    proxy_has_keys++;
                    if(proxy_has_keys){

                        //占位符替换(注意，写入占位符的时候，如果模块定义了别名，以别名来注册)
                        console.log('查看页面有无占位符:_SRC_MAP_');
                        var content = $.html();
                        content=replaceSrcMap(content,settings,proxy);
                        if(content == false){
                            console.log('页面没有srcMap占位符，准备自动插入设置脚本：\r\n');

                            //判断是否需要添加前置脚本，加在置底脚本的最前面
                            addSrcMapScript($,settings,proxy);
                        }else{
                            //如果替换成功
                            //最后将更改好的内容写回file
                            $.html(content);
                        }

                        break;
                    }
                }
                file.setContent($.html());

                content = file.getContent();
                $ = cheerio.load(content);

                //todo:当前生产环境md5等插件存在路径问题，现在全部统一删除属性，后面记得重新打开
                //判断如果是生产环境，则删除多余属性
                //if(fis.media()._media === 'prod'){
                console.log("生产环境构建，删除多余属性");
                clearOtherProperties($,settings);
                //}


                file.setContent($.html());

            }
        }else{
            console.log('不是 view:file:'+subpath);
        }
    }
}
///**
// * 插件入口函数，被fis框架调用
// * @param content:fis获取到的文件内容string
// * @param file:fis的文件对象
// * @param settings:插件配置
// * @returns {*}
// */
//var _ =module.exports = function (content, file, settings) {
//    //console.log("postprocessor: get file:"+file.subpath);
//
//
//}
