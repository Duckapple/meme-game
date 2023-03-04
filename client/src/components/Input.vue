<script lang="ts" setup>
const props = defineProps<{
  name?: string;
  maxlength?: number;
  placeholder: string;
  password?: boolean;
  text: string;
  onInput: (input: string) => void;
  upper?: boolean;
}>();
const maybeUpper = (s: string) => (props.upper ? s.toUpperCase() : s);
</script>
<template>
  <div class="group w-80 md:w-md lg:w-2xl">
    <input
      class="block pt-4 pb-2 text-2xl text-center text-gray-800 bg-transparent bg-gray-100 lg:pt-8 lg:pb-4 md:text-4xl lg:text-6xl w-80 md:w-md lg:w-2xl dark:text-gray-100 dark:bg-gray-800"
      :name="name"
      :type="password ? 'password' : 'text'"
      :placeholder="placeholder"
      :maxlength="maxlength"
      :value="text"
      @input="(e) => onInput(maybeUpper((e.target as Record<'value', string> | null)?.['value'] ?? ''))"
    />
    <div
      class="transition-[width,translate] w-0 h-1 -mt-1 bg-gray-800 group-hover:w-full group-focus-within:w-full dark:bg-gray-100"
    />
  </div>
</template>
