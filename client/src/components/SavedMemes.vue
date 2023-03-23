<script setup lang="ts">
import { computed, ref } from "vue";
import { store, visual_cdn } from "../state";
import { subscriptions } from "../comms";
import Meme from "./Meme.vue";
defineProps<{ goBack: () => void }>();
const currentCategory = ref<number>();
const popper = ref<number>();
const hoverIndex = ref<number>();
const currentImage = ref<HTMLCanvasElement>();
const hasClipboardItem = !!globalThis.ClipboardItem;
const dotsHidden = ref(false);

const categories = computed(() => {
  const cats = new Set();
  for (const meme of store.savedMemes) {
    cats.add(meme.visual);
  }
  return cats;
});
const filtered = computed(() => {
  const currentVisual = [...categories.value][currentCategory.value ?? 0];
  return store.savedMemes
    .map((meme, i) => ({ meme, i }))
    .filter(({ meme: { visual } }) => currentVisual === visual);
});
const copy = async () => {
  if (currentImage.value) {
    if (hasClipboardItem) {
      currentImage.value.toBlob((blob) => {
        if (blob) {
          const item = new ClipboardItem({ [blob.type]: blob });
          navigator.clipboard.write([item]);
          popper.value = undefined;
        }
      }, "image/png");
    }
  }
};
const save = async () => {
  if (currentImage.value) {
    const image = currentImage.value
      .toDataURL("image/png")
      .replace("image/png", "image/octet-stream");
    const a = document.createElement("a");
    a.setAttribute("download", "meme.png");
    a.href = image;
    a.click();
    popper.value = undefined;
  }
};
const debug = () => {
  if (popper.value != null) {
    const debugSub = subscriptions
      .filter(([type]) => type === "message")
      .at(-1) ?? [null, () => {}];
    const data = JSON.stringify(store.savedMemes[popper.value]);
    if ("handleEvent" in debugSub[1]) return;
    else debugSub[1]({ data } as any);
    popper.value = undefined;
  }
};
const log = console.log;
</script>

<template>
  <div
    v-if="visual_cdn"
    class="absolute inset-0 bg-white xl:p-16 dark:bg-gray-900"
  >
    <button
      class="fixed top-0 z-10 text-6xl text-white rotate-180 md:text-8xl left-4 md:top-4 text-shadow"
      @click="
        () =>
          currentCategory == null ? goBack() : (currentCategory = undefined)
      "
    >
      ➜
    </button>
    <button
      v-if="!hasClipboardItem && currentCategory != null"
      class="absolute px-2 py-1 md:px-6 md:py-3 btn top-6 md:top-12 right-4 md:left-36 md:right-[unset]"
      @click="dotsHidden = !dotsHidden"
    >
      Hide dots (for better screenshots)
    </button>
    <div
      v-if="currentCategory == null"
      class="absolute top-0 flex items-center justify-end w-3/4 h-20 text-right md:w-full md:text-2xl md:justify-center right-2 md:h-32"
    >
      <span
        >Meme templates, <span class="hidden md:inline">click</span
        ><span class="md:hidden">tap</span> to see memes made with each
        template</span
      >
    </div>
    <div
      v-if="currentCategory == null"
      class="grid flex-wrap grid-cols-3 mt-16 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 md:mt-24 xl:mt-12"
    >
      <button v-for="(visual, i) in categories" class="m-2 aspect-square">
        <img
          :src="visual_cdn + visual"
          class="aspect-square hover:outline outline-blue-500"
          width="512"
          height="512"
          @click="currentCategory = i"
        />
      </button>
    </div>
    <div
      v-if="currentCategory != null"
      class="grid w-full grid-cols-1 mt-16 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
    >
      <div
        v-for="{ i, meme: { top, bottom, visual } } in filtered"
        class="relative m-2"
        :id="`meme-${i}`"
      >
        <Meme
          :top="top"
          :bottom="bottom"
          :visual="visual"
          imageMode="stretch"
          :provide-image="(s) => (currentImage = s)"
          :should-provide-image="hoverIndex === i"
          @mouseenter="hoverIndex = i"
        />
        <img
          v-if="hoverIndex === i && currentImage"
          class="absolute inset-0"
          :src="currentImage.toDataURL()"
        />
        <button
          v-if="!dotsHidden"
          class="absolute z-10 text-5xl top-4 right-4 text-shadow"
          @click="popper = i"
        >
          &#8285;
        </button>
        <div
          v-if="popper === i"
          class="absolute z-20 flex flex-col items-start bg-white border divide-y rounded top-16 right-8 dark:bg-gray-900"
        >
          <button
            class="w-full px-4 py-2 text-left"
            :class="{
              disabled: !hasClipboardItem,
              'hover:bg-gray-100 dark:hover:bg-gray-700': hasClipboardItem,
            }"
            @click="hasClipboardItem ? copy() : (popper = undefined)"
          >
            {{
              hasClipboardItem
                ? "Copy to clipboard"
                : "To copy: right-click/long-press and copy"
            }}
          </button>
          <button
            class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="save"
          >
            Save locally
          </button>
          <button
            :class="{
              disabled: true,
              'hover:bg-gray-100 dark:hover:bg-gray-700': false,
            }"
            class="w-full px-4 py-2 text-left"
          >
            Uploading to meme server is coming!
          </button>
          <button
            class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
            @click="
              () => {
                store.savedMemes.splice(i, 1);
                popper = undefined;
              }
            "
          >
            Delete meme
          </button>
          <button
            v-if="store.settings.debug"
            @click="debug"
            class="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Dump in console
          </button>
        </div>
      </div>
    </div>
    <div
      v-if="popper != null"
      class="fixed inset-0 z-10 bg-white opacity-30 dark:bg-gray-900"
      title="click to close popper"
      @click="popper = undefined"
    />
  </div>
</template>
