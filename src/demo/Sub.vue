<template>
    <section>{{ hell }}</section>
</template>
<script lang="ts">
import { Component, Vue } from 'vue-property-decorator'
import { State } from '../motx-vue'
import { PlainObject } from '..'

@Component({})
export default class Sub extends Vue {
    @State('hello')
    protected hell
}
</script>
<style></style>
