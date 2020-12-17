import XdButton from './XdButton';
import XdInput from './XdInput';

const components = [XdButton, XdInput];

const install = function(Vue) {
  components.forEach((component) => {
    Vue.component(component.name, component);
  });
};

if (typeof window !== 'undefined' && window.Vue) {
  install(window.Vue);
}

export default {
  install, // 全量引入
  XdButton,
  XdInput
};
