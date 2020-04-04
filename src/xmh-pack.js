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

const res = createAsset("../entry/index.js");
console.log(res);
