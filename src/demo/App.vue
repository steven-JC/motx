<template>
    <section><CSub v-if="show" />{{ hell }}</section>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { State } from '../motx-vue'
import { PlainObject } from '..'
import CSub from './Sub.vue'
@Component({
    components: { CSub }
})
export default class App extends Vue {
    @State('hello')
    protected hell
    protected show = true
    protected mounted() {
        setTimeout(() => {
            this.show = false
        }, 3000)
    }
}
</script>
<style></style>
