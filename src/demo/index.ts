import { Vue } from 'vue-property-decorator'
import App from './App.vue'
import motx from './motx'
Vue.config.productionTip = false

Vue.use(motx)

new Vue({
    render: (h) => h(App)
}).$mount('#app')
