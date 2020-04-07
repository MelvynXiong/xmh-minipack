const path = require("path");
const fs = require("fs");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const { transformFromAstSync } = require("@babel/core");

let ID = 0;

/**
 * 1. 根据文件路径读取文件内容并返回它的依赖
 */
function createAsset(filename) {
  const content = fs.readFileSync(filename, "utf-8");

  // console.log(content);

  // 将 js 文件解析成抽象语法树
  const ast = parser.parse(content, {
    sourceType: "module",
  });

  // console.log('----------------------------------');
  // console.log(ast);
  // console.log('----------------------------------');

  // 存储当前模块依赖的模块的相对路径
  const dependencies = [];

  // 遍历 ast 来确定当前模块的依赖项，检查 import 声明
  traverse(ast, {
    ImportDeclaration: ({ node }) => {
      // console.log(node.source.value);

      dependencies.push(node.source.value);
    },
  });

  // 唯一标识当前模块
  const id = ID++;

  // 转译当前模块代码使其能够在浏览器环境中跑起来
  const { code } = transformFromAstSync(ast, null, {
    presets: ["@babel/preset-env"],
  });

  return {
    id,
    filename,
    code,
    dependencies,
  };
}

/**
 * 2. 从入口文件开始构建依赖图（dependency graph）
 */
function createGraph(entry) {
  // 入口文件的第一层依赖
  const mainAsset = createAsset(entry);

  // console.log(mainAsset);

  const queue = [mainAsset];

  // 广度优先（BFS）将所有的依赖项放入 queue
  for (const asset of queue) {
    asset.mapping = {};

    // 当前模块所在的文件目录
    const dirname = path.dirname(asset.filename);

    asset.dependencies.forEach((relativePath) => {
      const absolutePath = path.join(dirname, relativePath);
      const child = createAsset(absolutePath);

      // 将当前模块依赖项的相对路径和创建好了的依赖项实体一一对应起来
      asset.mapping[relativePath] = child.id;

      queue.push(child);
    });
  }

  return queue;
}

/**
 * 3. 根据依赖图构建一个能够在浏览器环境中运行的 js bundle
 */
function bundle(graph) {
  let modules = "";

  // console.log(graph);

  /**
   * 1. 为了命名空间的独立，需要将每个模块的代码放在一个独立的函数中
   * 2. 转译后的代码用的是 CommonJs 模块系统，需要注入 require, module, exports 对象
   * 3. 转译后的代码中会调用 require() 函数且参数为相对路径，需要 mapping 回具体的 module
   */
  graph.forEach((mod) => {
    modules += `${mod.id}: [
      function(require, module, exports){
        ${mod.code}
      },
      ${JSON.stringify(mod.mapping)},
    ],`;
  });
  /**
   * 1. 为了保证不污染全局变量，将代码放在 IIFE 中
   * 2. 将依赖图的信息作为参数传进去
   * 3. require(0) 加载入口模块
   */
  const result = `
    (function(modules){
      function require(id) {
        const [fn, mapping] = modules[id];

        function localRequire(name) {
          return require(mapping[name]);
        }
  
        const module = { exports: {} };

        fn(localRequire, module, module.exports);

        return module.exports;
      }

      require(0);
    })({${modules}})
  `;

  return result;
}

const graph = createGraph("../entry/index.js");
const result = bundle(graph);
console.log(result);
