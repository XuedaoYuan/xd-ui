import Vue from 'vue';
import App from './App.vue';

const xdUI = require('../lib/index');
require('../lib/index/style.css');
Vue.use(xdUI);

Vue.config.productionTip = false;

new Vue({
  render: (h) => h(App)
}).$mount('#app');
