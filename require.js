/** VIM： ET：TS=4：sw=4：STS=4
 * @license RequireJS 2.3.7 版权所有 jQuery Foundation 和其他贡献者。
 * 在 MIT 许可下发布，https://github.com/requirejs/requirejs/blob/master/LICENSE
 */
//不使用 strict：浏览器中的 strict 支持不均衡，#392，并导致 requirejs.exec（）/transpiler 插件出现问题，这些插件可能不严格。
/*jslint regexp： true， nomen： true， sloppy： true*/
/*全局窗口、导航器、文档、importScripts、setTimeout、opera*/

var requirejs, require, define;


(function (global, setTimeout) {





// ------------------------- ----------- ----------- ----------- ----------- ----------- ----------- var ----------- ----------- ----------- ----------- ----------- ----------- ----------- ----------- 







    
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.3.7',
        commentRegExp = /\/\*[\s\S]*?\*\/|([^:"'=]|^)\/\/.*$/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        isBrowser = !!(typeof window !== 'undefined' && typeof navigator !== 'undefined' && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 表示 loaded 和 complete，但需要特别等待 complete。序列是 'loading'， 'loaded'， 执行，然后 'complete'。UA 检查很遗憾，但不确定如何在不导致性能问题的情况下进行功能测试。
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
            /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //哦，悲剧，侦查歌剧。请参阅 isOpera 的用法了解原因。
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false,
        disallowedProps = ['__proto__', 'constructor'];
    












// ------------------------- ----------- ----------- ----------- ----------- ----------- ----------- ----------- utils ----------- ----------- ----------- ----------- ----------- ----------- ----------- 





    




    

    //可以匹配类似 '）//comment' 的内容，不要丢失 comment 的前缀。
    function commentReplace(match, singlePrefix) {
        return singlePrefix || '';
    }

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * 用于迭代数组的辅助函数。如果 func 返回 true 值，它将跳出循环。
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * 用于向后迭代数组的辅助函数。如果 func 返回 true 值，它将跳出循环。
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * 循环访问对象中的属性，并为每个属性值调用一个函数。如果函数返回 truthy 值，则停止迭代。
     */
    /* 上面的代码定义了一个名为 'eachProp' 的函数，它接受一个对象 'obj' 和一个函数
    'func' 作为参数。该函数迭代对象的每个属性并调用
    为函数 'func' 提供每个属性的键和值。*/
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop) && disallowedProps.indexOf(prop) == -1) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * 将 source 中的属性混合到 target 中的简单函数，但前提是 target 还没有同名的属性。
     */
    /* 上面的代码定义了一个名为 'mixin' 的 JavaScript 函数，它接受四个参数：
    'target'、'source'、'force' 和 'deepStringMixin'。该函数可能打算合并
    属性从 'source' 对象转移到 'target' 对象中。'force' 参数可能表示
    'target' 对象中的现有属性是否应被
    'source' 对象。'deepStringMixin' 参数可以指示字符串的深度合并是否
    properties 的*/
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value === 'object' && value &&
                        !isArray(value) && !isFunction(value) &&
                        !(value instanceof RegExp)) {

                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //类似于 Function.prototype.bind，但首先指定 'this' 对象，因为它更容易读取/弄清楚 'this' 将是什么。
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //允许获取以点表示法表示的全局变量，例如 'a.b.c'。
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * 使用指向包含详细信息的 URL 的指针构造错误。
     * @param {String} id 映射到网页上 ID 的错误 ID。
     * @param {String} 消息人类可读错误。
     * @param {Error} [err] 原始错误（如果有）。
     *
     * @returns {错误}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttps://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //如果定义已经通过另一个 AMD 加载程序进行播放，请不要覆盖。
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //不要覆盖现有的 requirejs 实例。
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //允许 require config 对象
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //假设它是一个 config 对象。
        cfg = require;
        require = undefined;
    }












// ------------------------- ----------- ----------- ----------- ----------- ----------- ----------- ----------- context ----------- ----------- ----------- ----------- ----------- ----------- ----------- 









    






    function newContext(contextName) {








        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //违约。不要为 map config 设置默认值以加快 normalize（） 的速度，如果没有 default，它会运行得更快。
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                bundles: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //刚刚启用的模块的注册表，以加快
            //当大量模块时打破代码
            //已注册，但未激活。
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            bundlesMap = {},
            requireCounter = 1,
            unnormalizedCounter = 1;
        
        


        



        

        /**
         * 修剪 .和。。从路径段数组中。
         * 如果 ..将成为第一个 path segment，以帮助进行模块名称查找，其作用类似于 paths，但可以重新映射。但最终结果，使用此函数的所有 paths 都应该看起来是标准化的。
         * 注意：此方法修改输入数组。
         * @param {Array} ary 路径段数组。
         */
        function trimDots(ary) {

            var i, part;

            for (i = 0; i < ary.length; i++) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    // 如果在 start 或上一个值仍然是 ..，请保留它们，以便在转换为路径时，即使作为 ID 它不太理想，它也可以在转换为路径时工作。在较大的小版本中，最好直接踢出错误。
                    if (i === 0 || (i === 1 && ary[2] === '..') || ary[i - 1] === '..') {
                        continue;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * 给定一个相对模块名称，如 ./something，将其规范化为可以映射到 path 的真实名称。
         * @param {String} name 相对名称
         * @param {String} baseName 名称 arg 是相对的真实名称
         * 自。
         * @param {Boolean} applyMap 将 map 配置应用于该值。应该
         * 仅当此规范化针对依赖项 ID 时，才执行此规范化。
         * @returns {String} 规范化名称
         */
        function normalize(name, baseName, applyMap) {


            var pkgMain, mapValue, nameParts, i, j, nameSegment, lastIndex,
                foundMap, foundI, foundStarMap, starI, normalizedBaseParts,
                baseParts = (baseName && baseName.split('/')),
                map = config.map,
                starMap = map && map['*'];

            

            //调整任何相对路径。
            if (name) {
                name = name.split('/');
                lastIndex = name.length - 1;

                // 如果需要节点 ID 兼容性，请从 ID 末尾剥离 .js。必须在这里执行此操作，而不是在 nameToUrl 中执行此操作，因为 node 允许 .js 或非 .js 映射到同一个文件。
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                // 以 '.' 开头，因此需要 baseName
                if (name[0].charAt(0) === '.' && baseParts) {
                    //将 baseName 转换为 array，并删除最后一部分，以便 .匹配该 'directory' 而不是 baseName 模块的名称。例如，'one/two/three' 的 baseName 映射到
                    //'one/two/three.js'，但我们需要目录 'one/two'
                    //这种正常化。
                    normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    name = normalizedBaseParts.concat(name);
                }

                trimDots(name);
                name = name.join('/');
            }

            //如果可用，请应用地图配置。
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                outerLoop: for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //在配置中找到最长的 baseName 段匹配项。
                        //因此，请在 basePart 的最大长度和最小长度上进行连接。
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName 段有 config，请查找它是否有
                            //这个名字。
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break outerLoop;
                                }
                            }
                        }
                    }

                    //检查星图匹配，但请稍等片刻，如果稍后在匹配配置中有较短的片段匹配，则优先于此星图。
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            // 如果 name 指向 package 的名称，请改用 package main。
            pkgMain = getOwn(config.pkgs, name);

            return pkgMain ? pkgMain : name;
        }

        /**
         * 根据提供的名称从 DOM 中删除 script 元素。
         * @param {string} name - 要删除的脚本元素的名称。
         * @returns 无
         */
        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                        scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        /* 上面的代码似乎是一个名为 'hasPathFallback' 的 JavaScript 函数，它接受
        'id' 参数。但是，函数体由占位符字符 （'*/
        function hasPathFallback(id) {

            var pathConfig = getOwn(config.paths, id);

            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                //弹出第一个数组值，因为它失败了，然后重试
                pathConfig.shift();
                context.require.undef(id);

                //custom require 不执行 map 翻译，因为
                //ID 为“绝对”，已映射/解析。
                context.makeRequire(null, {
                    skipMap: true
                })([id]);

                return true;
            }
        }

        //将 plugin！resource 转换为 [plugin， resource]，如果名称没有插件前缀，则插件为 undefined。
        function splitPrefix(name) {

            var prefix,
                index = name ? name.indexOf('!') : -1;
            
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * 创建包含插件前缀、模块名称和路径的模块映射。如果提供了 parentModuleMap，它还将通过 require.normalize（） 对名称进行规范化
         *
         * @param {String} name 模块名称
         * @param {String} [parentModuleMap] 父模块映射
         * 对于 Module name （模块名称），用于解析相对名称。
         * @param {Boolean} isNormalized： 是否已规范化的 ID。
         * 如果此调用是针对 define（） 模块 ID 完成的，则为 true。
         * @param {Boolean} applyMap：将 map 配置应用于 ID。
         * 仅当此 map 用于依赖项时，才应为 true。
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {


            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //如果没有 name，则表示它是一个 require 调用，生成一个内部名称。
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //如果有基本名称，则考虑相对路径。
            if (name) {
                if (prefix) {
                    if (isNormalized) {
                        normalizedName = name;
                    } else if (pluginModule && pluginModule.normalize) {
                        //Plugin 的 Plugin，请使用其 normalize 方法。
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        // 如果嵌套插件引用，则不要尝试规范化，因为它不会正确规范化。这对 resourceIds 施加了限制，
                        // 长期解决方案是在加载插件之前不进行规范化，并且所有规范化都允许异步加载加载器插件。
                        // 但现在，修复了常见用途。#1131 中的详细信息
                        normalizedName = name.indexOf('!') === -1 ?
                            normalize(name, parentName, applyMap) :
                            name;
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //由于 normalize 中的 map config 应用程序，Normalized name 
                    // 可能是插件 ID。映射配置值必须已经标准化，因此不需要重做该部分。
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //如果 id 是无法确定是否需要规范化的插件 ID，请使用唯一 ID 标记它，以便可以分隔两个可能冲突的匹配相对 ID。
            suffix = prefix && !pluginModule && !isNormalized ?
                '_unnormalized' + (unnormalizedCounter += 1) :
                '';

            

            
            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                    prefix + '!' + normalizedName :
                    normalizedName) + suffix
            };
        }

        /**
         * 函数 'getModule' 根据依赖关系映射从注册表中检索模块。
         * @param depMap - 'depMap' 参数是一个对象，其中包含有关模块的
         * 依赖。它通常包括一些属性，例如 'id' ，它代表模块的
         * 标识符。
         * @returns 正在返回 'mod' 变量。
         */
        function getModule(depMap) {


            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        /**
         * 函数 “on” 检查是否定义了模块并相应地调用指定的函数。
         * @param depMap - 'depMap' 是一个包含有关模块依赖项信息的对象。
         * @param名称 - “on”函数中的 'name' 参数表示
         * 函数正在监听。它用于确定何时触发提供的回调
         * 函数 'fn' 中。
         * @param fn - “on”函数中的“fn”参数是将执行的回调函数
         * 当指定模块 （'depMap'） 发生特定事件 （'name'） 时）。
         */
        function on(depMap, name, fn) {


            var id = depMap.id,
                mod = getOwn(registry, id);

            
            if (hasProp(defined, id) &&
                (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        /**
         * 函数 'onError' 通过通知已注册的错误处理程序或在未找到特定处理程序时触发默认错误处理程序来处理 JavaScript 模块中的错误。
         * @param err - “onError”函数中的 'err' 参数通常是一个错误对象，该对象
         * 包含有关所发生错误的信息。此对象可能包括
         * 'requireModules' 中，这是错误中涉及的模块 ID 数组。'err' 对象
         * 也可能包含其他
         * @param errback - 'onError' 函数中的 'errback' 参数是一个回调函数，它是
         * 如果提供，请使用 'err' 参数调用。如果提供了 'errback'，它将使用
         * 'err' 参数。否则，该函数将迭代 'ids' 数组
         */
        function onError(err, errback) {

            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //在 module 上设置 error，因此它会跳过超时检查。
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * 将 globalQueue 项目传输到此上下文的 defQueue 的内部方法。
         */
        function takeGlobalQueue() {
            //将所有 globalDefQueue 项推送到上下文的 defQueue 中
            if (globalDefQueue.length) {
                each(globalDefQueue, function (queueItem) {
                    var id = queueItem[0];
                    if (typeof id === 'string') {
                        context.defQueueMap[id] = true;
                    }
                    defQueue.push(queueItem);
                });
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return (defined[mod.map.id] = mod.exports);
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            return getOwn(config.config, mod.map.id) || {};
                        },
                        exports: mod.exports || (mod.exports = {})
                    });
                }
            }
        };

        /**
         * 根据给定的 ID 从 registry 和 enabledRegistry 中删除一个条目。
         * @param {string} id - 要删除的条目的 ID。
         * @returns 无
         */
        function cleanRegistry(id) {
            //清理用于等待模块的机器。
            delete registry[id];
            delete enabledRegistry[id];
        }

        /**
         * 递归地中断模块依赖关系图中的循环，以防止无限循环。
         * @param {Object} mod - 要打破循环的模块。
         * @param {Object} traced - 用于跟踪跟踪模块的对象。
         * @param {Object} processed - 用于跟踪已处理模块的对象。
         * @returns 无
         */
        function breakCycle(mod, traced, processed) {

            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //仅强制定义尚未完成的内容，因此仍在注册表中，并且仅当它尚未在模块中匹配时。
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        /**
         * 检查是否加载了所需的模块并处理任何错误或超时。
         * @returns 无
         */
        function checkLoaded() {


            var err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //可以使用 waitSeconds 0 来禁用等待间隔。
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //如果此调用是周期中断的结果，请不要打扰。
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //弄清楚所有模块的状态。
            eachProp(enabledRegistry, function (mod) {
                var map = mod.map,
                    modId = map.id;

                //跳过未启用或处于错误状态的内容。
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //如果应该执行模块，但尚未启动并且时间已到，请记住它。
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //没有理由继续寻找未完成的加载。如果唯一的 stillLoading 是一个插件资源，请继续，因为插件资源可能正在等待非插件周期。
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //如果等待时间已过，则抛出 unloaded modules 的错误。
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //未过期，检查周期。
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //如果仍在等待加载，并且等待的加载不是插件资源，或者仍有未完成的脚本，请稍后重试。
            if ((!expired || usingPathFallback) && stillLoading) {
                //有东西仍在等待加载。请等待它，但前提是超时尚未生效。
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        /**
         * 表示具有各种属性和方法的模块。
         * @param {Object} map - 模块的 map 对象。
         * @constructor
         */
        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = []，
               this.enabled、this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //如果已经完成，请不要执行更多 inits。如果同一模块有多个 define 调用，则可能会发生这种情况。这不是一个正常的、常见的情况，但也并非出乎意料。
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //注册此模块上的错误。
                    this.on('error', errback);
                } else if (this.events.error) {
                    //如果还没有 errback，但此模块上有错误侦听器，请设置一个 errback 以传递给 deps。
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //复制 dependency 数组，以便不修改 source inputs。例如
                //“shim” deps 直接传入此处，并且
                //直接修改 depMaps 数组
                //会影响该配置。
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //指示此模块已初始化
                this.inited = true;

                this.ignore = options.ignore;

                //可以选择在启用模式下初始化此模块，或者之前可能已标记为已启用。但是，在调用 init 之前，依赖项是未知的。因此，如果之前启用，现在将依赖项触发为已启用。
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            /**
             * 通过存储依赖项的导出并将其标记为匹配来定义依赖项。
             * @param {number} i - 依赖项的索引。
             * @param {any} depExports - 依赖项的导出。
             * @returns 无
             */
            defineDep: function (i, depExports) {
                //由于 cycles 的原因，可以为给定导出定义的回调多次调用。
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            /**
             * 如果尚未获取，则获取所需的资源。
             * @returns 无
             */
            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //如果 manager 用于插件托管资源，请让插件立即加载它。
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            /**
             * load 函数，该函数获取 URL 并加载相应的 map（如果之前未获取过）。
             * @returns 无
             */
            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * 检查模块是否已准备好定义自身，如果已准备好，则定义它。
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    // 仅当 defQueue 中尚未获取时才获取。
                    if (!hasProp(context.defQueueMap, id)) {
                        this.fetch();
                    }
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //工厂可能会触发另一个 require 调用，这将导致检查此模块以再次定义自身。如果已经在执行此操作，请跳过此工作。
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //如果存在错误侦听器，则倾向于传递给该侦听器，而不是引发错误。但是，只对 define（） 的模块执行此操作。require errbacks 不应因其回调中的失败而调用 （#699）。但是，如果设置了全局 onError，请使用它。
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            // 优先使用返回值而不是导出。如果 node/cjs 在起作用，那么无论如何都不会有返回值。优先使用 module.exports 赋值而不是 exports 对象。
                            if (this.map.isDefine && exports === undefined) {
                                cjsModule = this.module;
                                if (cjsModule) {
                                    exports = cjsModule.exports;
                                } else if (this.usingExports) {
                                    //exports 已设置定义的值。
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                var resLoadMaps = [];
                                each(this.depMaps, function (depMap) {
                                    resLoadMaps.push(depMap.normalizedMap || depMap);
                                });
                                req.onResourceLoad(context, this.map, resLoadMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //已完成定义阶段。Allow calling check again 以允许在循环的情况下定义下面的通知。
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            /* 上面的代码片段似乎是 JavaScript 对象或模块的一部分。这
            'callPlugin' 函数在此对象/模块中定义。但是，提供的代码
            不完整且包含占位符文本 ”*/
            callPlugin: function () {


                var map = this.map,
                    id = map.id,
                    //Map 已规范化前缀。
                    pluginMap = makeModuleMap(map.prefix);

                //将此标记为此插件的依赖项，以便可以跟踪周期。
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        bundleId = getOwn(bundlesMap, this.map.id),
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //如果当前映射未标准化，请等待该标准化名称加载，而不是继续。
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                            this.map.parentMap,
                            true);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.map.normalizedMap = normalizedMap;
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    //如果 paths 配置，则只需加载该文件即可解析插件，因为它内置于该 paths 层中。
                    if (bundleId) {
                        this.map.url = context.nameToUrl(bundleId);
                        this.load();
                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //从 2.1.0 开始，支持仅传递文本，以加强每个资源仅调用一次的 fromText。仍然支持传递 moduleName 的旧样式，但丢弃该 moduleName 以支持内部 ref。
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                'fromText eval for ' + id +
                                ' failed: ' + e,
                                e,
                                [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //在这里使用 parentName，因为插件的名称不可靠，可能是一些没有路径的奇怪字符串，实际上想要引用 parentName 的路径。
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {


                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //设置标志，说明模块正在启用，以便立即调用为依赖项定义的回调，而不会在 depCount 仍为零的情况下触发意外加载。
                this.enabling = true;

                //启用每个依赖项
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //依赖项需要转换为 depMap 并连接到此模块。
                        depMap = makeModuleMap(depMap,
                            (this.map.isDefine ? this.map : this.map.parentMap),
                            false,
                            !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            if (this.undefed) {
                                return;
                            }
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        } else if (this.events.error) {
                            // 此模块没有直接的 errback，但其他东西正在侦听错误，因此请务必正确传播错误。
                            on(depMap, 'error', bind(this, function (err) {
                                this.emit('error', err);
                            }));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //跳过特殊模块，如 'require'、'exports'、'module'
                    //此外，如果 enable 已启用，请不要调用 enable，这在循环依赖关系情况下很重要。
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //启用依赖项中使用的每个插件
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },


            on: function (name, cb) {


                var cbs = this.events[name];


                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //现在，错误处理程序已触发，请删除侦听器，因为这个损坏的 Module 实例可以在注册表中保留一段时间。
                    delete this.events[name];
                }
            }
        };

        /**
         * 如果尚未定义模块，则使用提供的参数调用 getModule 函数。
         * @param {Array} args - 要传递给 getModule 函数的参数数组。
         * @returns 无
         */
        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }
        /**
         * 函数 'removeListener' 用于从 DOM 元素中删除事件侦听器，处理 IE 和其他浏览器之间的差异。
         * @param 节点 - 'removeListener' 函数中的 'node' 参数表示要
         * 事件侦听器当前附加的 URL。此元素是事件从中
         * listener 将被删除。
         * @param func - 'removeListener' 函数中的 'func' 参数是回调函数，该函数
         * 之前已作为事件侦听器添加到 'node' 中。此功能将从
         * 基于提供的 'name' 和 'ieName' 参数的 'node' 事件侦听器。
         * @param name - 'removeListener' 函数中的 'name' 参数表示事件的名称
         * 之前已添加到 'node' 元素中。此具有指定名称的事件侦听器将为
         * 调用此函数时从节点中删除。
         * @param ieName - 'removeListener' 函数中的 'ieName' 参数是一个字符串，表示
         * Internet Explorer 的事件名称。在 Internet Explorer 中，事件名称与标准
         * 事件名称，因此此参数允许您指定正确的事件名称
         * 对于 IE，当分离事件时
         */

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * 给定来自脚本节点的事件，从中获取 requirejs 信息，然后删除节点上的事件侦听器。
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //为了 Firefox 2.0 而使用 currentTarget 而不是 target。并非所有旧浏览器都受支持，但这个浏览器很容易支持并且仍然有意义。
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        /**
         * 函数 'intakeDefines' 处理全局队列中的已定义模块，并处理 'defQueue' 中的任何剩余项目。
         * @returns 函数 'intakeDefines（）' 返回 'onError（）' 函数的结果，其中
         * 参数 'makeError（'mismatch'， '不匹配的匿名 define（） module： ' + args[args.length -
         * 1]）'。
         */
        function intakeDefines() {


            var args;

            //全局队列中任何已定义的模块，现在都要摄取它们。
            takeGlobalQueue();

            //确保正确处理任何剩余的 defQueue 项目。
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' +
                        args[args.length - 1]));
                } else {
                    //参数是 id、deps、factory。应通过
                    //define（） 函数。
                    callGetModule(args);
                }
            }
            context.defQueueMap = {};
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            defQueueMap: {},
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * 设置上下文的配置。
             * @param {Object} cfg config 对象进行集成。
             */
            configure: function (cfg) {
                //确保 baseUrl 以斜杠结尾。
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                // 将旧式 urlArgs 字符串转换为函数。
                if (typeof cfg.urlArgs === 'string') {
                    var urlArgs = cfg.urlArgs;
                    cfg.urlArgs = function (id, url) {
                        return (url.indexOf('?') === -1 ? '?' : '&') + urlArgs;
                    };
                }

                //保存路径，因为它们需要特殊处理，它们是累加的。
                var shim = config.shim,
                    objs = {
                        paths: true,
                        bundles: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (!config[prop]) {
                            config[prop] = {};
                        }
                        mixin(config[prop], value, true, true);
                    } else {
                        config[prop] = value;
                    }
                });

                //反向映射束
                if (cfg.bundles) {
                    eachProp(cfg.bundles, function (value, prop) {
                        each(value, function (v) {
                            if (v !== prop) {
                                bundlesMap[v] = prop;
                            }
                        });
                    });
                }

                //合并填充码
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //规范化结构
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //如有必要，请调整软件包。
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location, name;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;

                        name = pkgObj.name;
                        location = pkgObj.location;
                        if (location) {
                            config.paths[name] = pkgObj.location;
                        }

                        //保存指向 pkg name 的主模块 ID 的指针。
                        //删除 main 中的前导点，以便 main 路径被规范化，并删除任何尾随.js，因为不同的软件包环境有不同的约定：有些使用模块名称，有些使用文件名。
                        config.pkgs[name] = pkgObj.name + '/' + (pkgObj.main || 'main')
                            .replace(currDirRegExp, '')
                            .replace(jsSuffixRegExp, '');
                    });
                }

                //如果注册表中有任何 “waiting to execute” 模块，请为它们更新映射，因为它们的信息（如要加载的 URL）可能已更改。
                eachProp(registry, function (mod, id) {
                    //如果 module 已经调用了 init，因为修改它们为时已晚，并忽略未规范化的，因为它们是瞬态的。
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id, null, true);
                    }
                });

                //如果指定了 deps 数组或 config 回调，则使用这些参数调用 require。当 require 在加载之前被定义为 config 对象时require.js这很有用。
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            /**
             * 根据提供的值创建 shim 导出函数。
             * @param {any} value - 要为其创建 shim 导出函数的值。
             * @returns {Function} 一个函数，充当所提供值的填充码导出。
             */
            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },


            /**
             * 创建具有可选选项的本地 require 函数。
             * @param {Object} relMap - 相对贴图对象。
             * @param {Object} 选项 - 选项对象。
             * @returns {Function} 本地 require 函数。
             */
            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                id +
                                '" has not been loaded yet for context: ' +
                                contextName +
                                (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                            relMap && relMap.id, true), ext, true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        mod.undefed = true;
                        removeScript(id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        //Clean queued defines too. Go backwards
                        //in array so that the splices do not
                        //mess up the iteration.
                        eachReverse(defQueue, function (args, i) {
                            if (args[0] === id) {
                                defQueue.splice(i, 1);
                            }
                        });
                        delete context.defQueueMap[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * 如果模块仍在注册表中等待启用，则调用该模块以启用该模块。当此方法被优化器覆盖时，第二个 arg parent（父模块）将传入 context 中。此处不显示以保持代码紧凑。
             */
            enable: function (depMap) {


                var mod = getOwn(registry, depMap.id);


                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * 环境适配器用于完成 load 事件的内部方法。
             * 加载事件可以是脚本加载，也可以只是来自同步加载调用的加载传递。
             * @param {String} moduleName 可能完成的模块的名称。
             */
            completeLoad: function (moduleName) {


                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //如果已经找到了一个匿名模块并将其绑定到此名称，那么这是另一个等待其 completeLoad 触发的匿名模块。
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //找到此脚本的匹配定义调用！
                        found = true;
                    }

                    callGetModule(args);
                }
                context.defQueueMap = {};

                //在 callGetModule 周期之后执行此操作，以防这些 calls/init 调用的结果更改了注册表。
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                'No define call for ' + moduleName,
                                null,
                                [moduleName]));
                        }
                    } else {
                        //一个不调用 define（） 的脚本，所以只需模拟它的调用。
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * 将模块名称转换为文件路径。支持 moduleName 实际上可能只是一个 URL 的情况。
             * 请注意，它 **不会** 对 moduleName 调用 normalize，而是假定它已经被 normalized 了。这是一个内部 API，而不是公共 API。将 toUrl 用于公共 API。
             */
            nameToUrl: function (moduleName, ext, skipExt) {


                var paths, syms, i, parentModule, url,
                    parentPath, bundleId,
                    pkgMain = getOwn(config.pkgs, moduleName);


                

                if (pkgMain) {
                    moduleName = pkgMain;
                }

                bundleId = getOwn(bundlesMap, moduleName);

                if (bundleId) {
                    return context.nameToUrl(bundleId, ext, skipExt);
                }

                //如果 URL 中有冒号，则表示使用了协议，它只是文件的 URL，或者如果它以斜杠开头，包含查询 arg（即 ？）或以 .js 结尾，则假设用户打算使用 url 而不是模块 ID。
                //斜杠对于无协议 URL 和完整路径非常重要。
                if (req.jsExtRegExp.test(moduleName)) {
                    //只是一个普通的路径，而不是模块名称查找，所以只返回它。
                    //如果包含扩展名，则添加扩展名。这有点不稳定，只有在 non-.js 事物通过扩展时，此方法可能需要重新设计。
                    url = moduleName + (ext || '');
                } else {
                    //需要转换为 path 的模块。
                    paths = config.paths;

                    syms = moduleName.split('/');
                    //对于每个模块名称段，查看是否有为其注册的路径。从最具体的名称开始，然后以此为基础。
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');

                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        }
                    }

                    //将路径部分连接在一起，然后确定是否需要 baseUrl。
                    url = syms.join('/');
                    url += (ext || (/^data\:|^blob\:|\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs && !/^blob\:/.test(url) ?
                    url + config.urlArgs(moduleName, url) : url;
            },

            //委托 req.load.作为单独的函数分解，以允许在优化器中覆盖。
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * 执行模块回调函数。作为单独的函数分解，仅用于允许构建系统以正确的顺序对构建层中的文件进行排序。
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * 脚本加载的回调，用于检查加载状态。
             *
             * @param {Event} evt 从浏览器为脚本创建事件
             * 那是装弹的。
             */
            onScriptLoad: function (evt) {
                //为了 Firefox 2.0 而使用 currentTarget 而不是 target。并非所有旧浏览器都受支持，但这个浏览器很容易支持并且仍然有意义。
                if (evt.type === 'load' ||
                    (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //重置交互式脚本，以便脚本节点不会长时间保留。
                    interactiveScript = null;

                    //拉出模块的名称和上下文。
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * 脚本错误的回调。
             */
            onScriptError: function (evt) {


                var data = getScriptData(evt);



                if (!hasPathFallback(data.id)) {
                    var parents = [];
                    eachProp(registry, function (value, key) {
                        if (key.indexOf('_@r') !== 0) {
                            each(value.depMaps, function (depMap) {
                                if (depMap.id === data.id) {
                                    parents.push(key);
                                    return true;
                                }
                            });
                        }
                    });
                    return onError(makeError('scripterror', 'Script error for "' + data.id +
                        (parents.length ?
                            '", needed by: ' + parents.join(', ') :
                            '"'), evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }















// ------------------------- ----------- ----------- ----------- ----------- ----------- ----------- -----------  ----------- ----------- ----------- ----------- ----------- ----------- ----------- 



















    /**
     * 主入口点。
     *
     * 如果 require 的唯一参数是字符串，则为适当的上下文获取该字符串表示的模块。
     *
     * 如果第一个参数是一个数组，那么它将被视为要获取的依赖项字符串名称的数组。可以指定一个可选的函数 callback 在所有这些依赖项都可用时执行。
     *
     * 制作一个本地 req 变量以帮助 Caja 合规（它假设 require 上的内容不是标准化的），并给出一个简短的名称以供缩小/本地范围使用。
     */
    req = requirejs = function (deps, callback, errback, optional) {



        //找到合适的上下文，使用 default
        var context, config,
            contextName = defContextName;

        

        
        // 确定调用中是否有 config 对象。
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps 是一个 config 对象
            config = deps;
            if (isArray(callback)) {
                // 如果有依赖项，请调整 args
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }




        return context.require(deps, callback, errback);
    };

    /**
     * 支持 require.config（） 以使其更容易与其他
     * AMD 加载全球公认的名称。
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * 在事件循环的当前 tick 之后执行一些操作。覆盖具有比 setTimeout 更好的解决方案的其他环境。
     * @param {Function} fn 函数稍后执行。
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * 将 require 导出为全局变量，但前提是它尚不存在。
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //用于筛选掉已经是路径的依赖项。
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //创建默认上下文。
    req({});

    //导出一些对全局 require 的上下文敏感的方法。
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //引用，而不是早期绑定到默认上下文，以便在构建期间使用默认上下文的最新实例及其配置。
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //如果 BASE 标签正在使用，则使用 appendChild 对 IE6 来说是个问题。
        //当该浏览器死机时，可以将其删除。此 jQuery 错误的详细信息：http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * 任何需要显式生成的错误都将传递给此函数。如果你想要自定义错误处理，请拦截/覆盖它。
     * @param {Error} err 错误对象。
     */
    req.onError = defaultOnError;

    /**
     * 为 load 命令创建节点。仅用于浏览器环境。
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
            document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
            document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * 请求加载浏览器情况下的模块。
     * 将此函数设为单独的函数，以允许其他环境覆盖它。
     *
     * @param {Object} 上下文中查找状态的 require 上下文。
     * @param {String} moduleName 模块的名称。
     * @param {Object} url 模块的 URL。
     */
    req.load = function (context, moduleName, url) {



        var config = (context && context.config) || {},
            node;


        
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //设置 load listener。首先测试 attachEvent，因为 IE9 的 addEventListener 和脚本 onload 触发中存在一个微妙的问题，
            // 该问题与所有其他支持 addEventListener 的浏览器的行为不匹配，这些浏览器在脚本执行后立即触发脚本的 onload 事件。
            // 另请： https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //不幸的是，Opera 实现了 attachEvent，但不遵循脚本脚本执行模式。
            if (node.attachEvent &&
                //检查 node.attachEvent 是否是自定义脚本人为添加的，还是浏览器读取 https://github.com/requirejs/requirejs/issues/187 原生支持的，如果我们找不到 [原生代码]，那么它一定不是原生支持的。
                //在 IE8 中，node.attachEvent 不必 toString（）
                //请注意对没有右大括号的 “[native code” 的测试，请参阅：https://github.com/requirejs/requirejs/issues/273
                !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                !isOpera) {
                //可能是 IE。IE（至少 6-8 个）在执行脚本后不会立即触发脚本 onload，因此我们不能将匿名 define 调用绑定到名称。
                //但是，IE 在执行 define 调用时将脚本报告为处于 'interactive' readyState。
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //如果在此处添加一个错误处理程序来捕获，那就太好了
                //IE9+ 中的 404 秒。但是，onreadystatechange 将在
                //错误处理程序，因此这无济于事。如果 addEventListener
                //，则 IE 会在加载前触发错误，但我们不能
                //鉴于 connect.microsoft.com 问题，请使用该途径
                //上面提到了不执行 'script execute，
                //然后在执行之前触发脚本 Load 事件侦听器
                //next 脚本。
                //希望：IE10 修复了这些问题，然后销毁了 IE 6-9 的所有安装。
                //node.attachEvent（'onerror'， context.onScriptError）;
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //在设置节点上的所有属性之后，但在将其放入 DOM 之前调用 onNodeCreated。
            if (config.onNodeCreated) {
                config.onNodeCreated(node, config, moduleName, url);
            }

            //对于 IE 6-8 中的某些缓存情况，脚本在 appendChild 执行结束之前执行，因此要将匿名 define 调用绑定到模块名称（存储在节点上），请保留对此节点的引用，但在 DOM 插入后清除。
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //在 Web Worker 中，使用 importScripts。这不是对 importScript 的非常有效的使用，importScripts 会阻塞，直到下载和评估其脚本。
                // 但是，如果 Web Worker 正在运行，则预期是已经完成了构建，因此无论如何都只需要加载一个脚本。如果其他用例变得普遍，则可能需要重新评估这一点。

                // 将任务发布到事件循环，以解决 WebKit 中的错误，即在调用 importScripts（） 后，工作程序被垃圾回收：https://webkit.org/b/153317
                setTimeout(function () { }, 0);
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                    'importScripts failed for ' +
                    moduleName + ' at ' + url,
                    e,
                    [moduleName]));
            }
        }
    };

    /**
     * 从 DOM 中检索交互式脚本元素。
     * 如果已找到交互式脚本并且其 readyState 为 'interactive'，则返回该脚本。
     * 否则，它将以相反的顺序遍历所有脚本元素，并返回 readyState 为 'interactive' 的第一个脚本元素。找到的交互式脚本存储在 interactiveScript 变量中。
     * @returns 交互式脚本元素（如果找到），否则返回 undefined。
     */
    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //查找 data-main 脚本属性，该属性也可以调整 baseUrl。
    if (isBrowser && !cfg.skipDataMain) {
        //找出 baseUrl。从带有 require.js 的 script 标签中获取它。
        eachReverse(scripts(), function (script) {
            //设置“head”，我们可以在其中使用脚本的 parent来附加 children。
            if (!head) {
                head = script.parentNode;
            }

            //查找 data-main 属性以设置要加载的页面的主脚本。如果存在，则 data main 的路径将变为 baseUrl（如果尚未设置）。
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //保留 dataMain，以防它是路径（即包含 '？'）
                mainScript = dataMain;

                //如果还没有明确的 baseUrl，请设置最终的 baseUrl，但仅当 data-main 值不是 loader 插件模块 ID 时才这样做。
                if (!cfg.baseUrl && mainScript.indexOf('!') === -1) {
                    //提取 data-main 的目录以用作 baseUrl。
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/') + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //去掉任何尾部.js因为 mainScript 现在就像一个模块名称。
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                //如果 mainScript 仍为路径，则回退到 dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //将 data-main 脚本放入要加载的文件中。
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * 处理模块定义的函数。与 require（） 的不同之处在于，模块的字符串应该是第一个参数，并且在加载依赖项后执行的函数应该返回一个值来定义与第一个参数的名称相对应的模块。
     */
    define = function (name, deps, callback) {




        var node, context;




        //允许匿名模块
        if (typeof name !== 'string') {
            //适当调整参数
            callback = deps;
            deps = name;
            name = null;
        }

        //此模块可能没有依赖项
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //如果没有 name，并且 callback 是一个函数，那么弄清楚它是否是一个
        //CommonJS 的东西。
        if (!deps && isFunction(callback)) {
            deps = [];
            //从回调字符串中删除注释，查找 require 调用，并将它们拉入依赖项，但前提是存在函数 args。
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, commentReplace)
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //即使没有 require 调用，也可能是 CommonJS 的东西，但仍然可以使用 exports 和 module。如果只需要 require，请避免进行 exports 和 module 工作。
                //要求函数按照下面列出的顺序期望 CommonJS 变量。
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //如果在 IE 6-8 中点击匿名 define（） 调用，请执行交互式工作。
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //始终将评估 def 调用保存到脚本 onload 处理程序之前。
        //这允许多个模块位于一个文件中，而不会过早地跟踪依赖项，并允许匿名模块支持，其中模块名称在脚本 onload 事件发生之前是未知的。如果没有上下文，请使用全局队列，并在 onscript load 回调中对其进行处理。
        if (context) {
            context.defQueue.push([name, deps, callback]);
            context.defQueueMap[name] = true;
        } else {
            globalDefQueue.push([name, deps, callback]);
        }
    };

    define.amd = {
        jQuery: true
    };

    /**
     * 执行文本。通常只使用 eval，但可以修改以使用更好的、特定于环境的调用。仅用于转译 loader 插件，不用于纯 JS 模块。
     * @param {String} 文本指定要执行/评估的文本。
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //使用 config info 进行设置。
    req(cfg);






}(this, (typeof setTimeout === 'undefined' ? undefined : setTimeout)));
