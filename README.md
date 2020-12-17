# 搭建Vue组件库支持按需引入

[TOC]

​	整了一个早上， 看了别人的各种经验整的一个不是很完善的方案吧。目前只支持到能够打包各自的组件和css文件。配合`babel-plugin-import`插件可以在使用的时候按需引入自己写的组件。具体操作我后面会写。
	后续的功能，比如icon、字体、主题、typescript，公共css引入，国际化，或者基于别人的UI库再封装等等。都可以慢慢加入。

​	大概的坏境` Vue@2.6、Vue-cli@4.5.8、webpack@4`

### 一、组件库的搭建

Vue组件库， 目前也是基于vue-cli4搭建的。手动选择需要的内容，如下

```bash
Vue CLI v4.5.9
? Please pick a preset: Manually select features
? Check the features needed for your project: Choose Vue version, Babel, CSS Pre
-processors
? Choose a version of Vue.js that you want to start the project with 2.x
? Pick a CSS pre-processor (PostCSS, Autoprefixer and CSS Modules are supported 
by default): Stylus
? Where do you prefer placing config for Babel, ESLint, etc.? In dedicated confi
g files
? Save this as a preset for future projects? No
```

到此有了一个基础的包

#### 1.1 新建自定义组件文件夹

根目录下创建`packages`文件夹, 同时创建自己的组件，目录结构可以如下

```
packages
	XdButton
		src
			XdButton.vue
		index.js
	XdInput
		src
			XdInput.vue
		index.js
	index.js
```

我们先看组件比如`XdButton.vue`

```vue
<template>
  <button>按钮</button>
</template>

<script>
export default {
  name: 'XdButton',
  data() {
    return {};
  }
};
</script>

<style lang="stylus">
button {
  color: green;
  font-size: 14px;
}
</style>

```

再看一下`packages/XdButton/index.js`,其他的同理

```js
// 导入组件
import XdButton from './src/XdButton.vue';
// 给组件添加install方法
XdButton.install = (Vue) => Vue.component(XdButton.name, XdButton);
// 导出默认组件
export default XdButton;

```

最后看一下`packages/index.js`

```js
import XdButton from './XdButton';
import XdInput from './XdInput';
// 组件列表
const components = [
    XdButton, 
    XdInput
];

// 全局注册组件的install方法
const install = function(Vue) {
  components.forEach((component) => {
    Vue.component(component.name, component);
  });
};

// 如果通过script直接引入
if (typeof window !== 'undefined' && window.Vue) {
  install(window.Vue);
}

// 导出默认对象， 注意必须包含install方法
export default {
  install, // 全量引入
  XdButton,
  XdInput
};

```

到目前为止我们的组件库创建好了。具体的内容比较简单而已。

#### 1.2 配置Webpack

由于使用了vue-cli， 所以我们第一步新建`vue.config.js`,内容可以参考如下

```js
const devConfig = require('./build/config.dev');
const buildConfig = require('./build/config.build');
module.exports = process.env.NODE_ENV === 'production' ? buildConfig : devConfig;
```

所以我们还需要创建`build`文件夹, 以及`config.dev.js、config.build.js`两个配置文件。

`config.dev.js` 还在思索中

`config.build.js`可以参考如下

```js
const fs = require('fs');
const path = require('path');
const join = path.join;
//  获取基于当前路径的目标文件
const resolve = (dir) => path.join(__dirname, '../', dir);

/*
主要用于生成入口文件，返回值类似于
{
	index: "xxxx/xxx/xxx/index.js",
	XdButton: "xxxx/xxx/XdButton/index.js,
	...
}
主要用作webpack的入口
*/
function getComponentEntries(path) {
  let files = fs.readdirSync(resolve(path));

  const componentEntries = files.reduce((fileObj, item) => {
    //  文件路径
    const itemPath = join(path, item);
    //  在文件夹中
    const isDir = fs.statSync(itemPath).isDirectory();
    const [name, suffix] = item.split('.');

    //  文件中的入口文件
    if (isDir) {
      fileObj[item] = resolve(join(itemPath, 'index.js'));
    }
    //  文件夹外的入口文件
    else if (suffix === 'js') {
      fileObj[name] = resolve(`${itemPath}`);
    }
    return fileObj;
  }, {});

  return componentEntries;
}

const buildConfig = {
  //  输出文件目录
  outputDir: resolve('lib'),
  //  webpack配置
  configureWebpack: {
    //  入口文件
    entry: getComponentEntries('packages'),
    //  输出配置
    output: {
      //  文件名称
      filename: '[name]/index.js',
      //  构建依赖类型
      libraryTarget: 'commonjs2',
      //  库中被导出的项
      libraryExport: 'default',
      //  引用时的依赖名
      library: 'xd-ui'
    }
  },
  css: {
    sourceMap: true,
    // 配置css.extract 表明css会单独打包，主要方便我们做按需加载
    extract: {
      filename: '[name]/style.css'
    }
  },
  chainWebpack: (config) => {
    config.optimization.delete('splitChunks');
    config.plugins.delete('copy');
    config.plugins.delete('preload');
    config.plugins.delete('prefetch');
    config.plugins.delete('html');
    config.plugins.delete('hmr');
    config.entryPoints.delete('app');
  }
};
module.exports = buildConfig;

```

说一下chainWebpack里面的内容

1. 删除splitChunks，在打包组件的时候，并不希望抽离每个组件的公共js出来，而是每个独立打包，于是删除这个配置；
2. 删除copy：不要复制public文件到打包目录；
3. 删除preload以及prefetch，因为删除了html插件，所以这两个也没用；
4. 删除html，只打包组件，不生成html页面；
5. 删除hmr，删除hot-module-reload；
6. 删除自动加上的入口：app

#### 1.3 打包

不想和`npm run build`一样的话可以加 **lib** 脚本

```json
{
  "scripts": {
    "serve": "vue-cli-service serve",
    "build": "vue-cli-service build",
    "lib": "vue-cli-service build"
  }
}
```

最后试一下 `npm run lib`

如果不出错的话就可以打包出内容了

#### 1.4 推送到npm

如何推送到npm教程我就不说了，建议可以使用sinopia搭建一个自己的私有npm库，配合`nrm` 管理`registry`
具体说一下这个推送需要配置哪些内容吧。一般npm我们需要配置`package.json`

再此之前我们也可以先新建一个 `.npmignore`, 表明哪些内容在发布需要忽略，如下

```
# 忽略目录
examples/
packages/
public/
src/

 
# 忽略指定文件
vue.config.js
babel.config.js
*.map
```

接下来说一下 `package.json`注意点。

1. `name`属性:由于我们在之前的webpack配置中，已经设置了输出包的名字 `output.library`为**xd-ui**。所以我们也把第一行的`name`属性设置为**xd-ui**。这个名字可以自己取。
2. `main`属性: 用于我们比如使用 `import XdUI from "xd-ui"`时，指定从这里全局导出。（目前我失败了，不知道对不对）
3. `files`属性: 用于在`npm publish`推送时表示推送哪些文件或文件夹
4. `private`如果要发布的话必须设置为`false`
5. `version`每次publish发布都必须修改`version`

```json
{
  "name": "xd-ui",
  "main": "lib/index/index.js",
  "files": [
    "lib"
  ],
  "version": "1.0.4",
  "private": false,
  "scripts": {
    "serve": "vue-cli-service serve",
    "build": "vue-cli-service build",
    "lib": "vue-cli-service build"
  },
  "dependencies": {
    "core-js": "^3.6.5",
    "vue": "^2.6.11"
  },
  "devDependencies": {
    "@vue/cli-plugin-babel": "~4.5.0",
    "@vue/cli-service": "~4.5.0",
    "stylus": "^0.54.7",
    "stylus-loader": "^3.0.2",
    "vue-template-compiler": "^2.6.11"
  }
}

```

到这里我假定都发布成功了，也就是我们可以通过 `npm i xd-ui -S`下载我们自己的库

### 二、组件库的使用，也即用在业务中

如果想要用在页面， 那么我们也可以暂时新建一个工程，比如也用vue-cli新建一个工程， 这里我就不描述了。

新建了工程之后我们安装需要的包，如果需要按需引入的话， 使用babel插件`babel-plugin-import`,他的主要作用是代码语法转换，比如可以把如下的代码

```js
import { XdButton } from 'xd-ui'
```

转换为

```js
var XdButton = require('xd-ui/lib/XdButton')
require('xd-ui/lib/XdButton/style.css')
```

css 就是这样子单独引入的。后面的`lib`是默认的，因为我们的库设定的导出文件夹就是`lib`。

#### 2.1 安装插件 

```bash
npm i babel-plugin-import -D 
```

修改babel配置文件 `babel.config.js`为。主要增加`import`选项， 其他若不一致可以不动

```js
module.exports = {
  presets: ['@vue/cli-plugin-babel/preset'],
  plugins: [
    [
      'import',
      {
        libraryName: 'xd-ui',
        style: (name) => {
          return `${name}/style.css`;
        },
        camel2DashComponentName: false, // 是否需要驼峰转短线
        camel2UnderlineComponentName: false // 是否需要驼峰转下划线
      }
    ]
  ]
};

```

#### 2.2 安装组件包以及注册使用

```bash
npm i xd-ui -S
```

全局注册，（目前有一个缺陷，还不知道怎么解决， 就是你得如下这样子引入全局然后注册，而不是我们常用的
`import XdUi from 'xd-ui'`。这个不知道还需要配置哪里，有点2

```js
import XdUi from 'xd-ui/lib/index';
Vue.use(XdUi);
```

如果这样子全局注册就可以直接用了。 比如 

```vue
<template>
  <div id="app">
    <XdButton></XdButton>
  </div>
</template>
```

或者采用按需的方式。css也是会加载的

```vue
<script>
import { XdButton, XdInput } from 'xd-ui';
export default {
  name: 'App',
  components: {
    XdButton,
    XdInput
  }
};
</script>
```

#### 2.3 欢迎完善和指正，

后续有时间也会继续完善，目前只是走通基础的流程。