<template>
    <section><CSub v-if="show" />{{ hell }}</section>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { State } from '../motx-vue'
import CSub from './Sub.vue'
import motx from './motx'
@Component({
    components: { CSub }
})
export default class App extends Vue {
    @State('hello')
    protected hell
    protected show = true
    protected mounted() {
        setTimeout(() => {
            motx.setState('hello', 'funckkkkk')
        }, 1000)
        setTimeout(() => {
            motx.setState('hello', 'funck')
        }, 2000)

        setTimeout(() => {
            motx.setState('hello', 'funck333333')
        }, 3000)
    }
}
</script>
<style></style>
