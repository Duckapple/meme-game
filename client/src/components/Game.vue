<script lang="ts" setup>
import { computed, effect, ref, watch } from "vue";
import { MakeMoveFunction } from "../App.vue";
import type { GameState, GameSettings, FullCard, Move, Card } from "../model";
import { store, visual_cdn } from "../state";
import Tile from "./Tile.vue";
import { mapValues } from "lodash";
import { setTitle } from "../title";

const props = defineProps<{
  state: GameState;
  hand: Record<"top" | "bottom", FullCard[]>;
  players: string[];
  username: string;
  creator: string;
  settings: GameSettings;
  // onMakeMove: MakeMoveFunction;
}>();

const incomingMove = ref<Partial<Move>>();

const updateIncomingMove = <K extends keyof Move>(key: K, value: Move[K]) => {
  if (!incomingMove.value) incomingMove.value = { player: props.username };
  if (incomingMove.value[key] === value)
    return (incomingMove.value[key] = undefined);
  incomingMove.value[key] = value;
};

const stateText = computed(() => {
  return JSON.stringify({ ...props.state, hand: props.hand }, null, 2);
});
const visualUrl = computed(() => {
  return props.state.visual ? visual_cdn.value + props.state.visual : undefined;
});
const visual = ref<{ image?: HTMLImageElement; url?: string }>({});
const hasLoaded = ref(false);
// visual.value?.addEventListener("load", () => {
//   hasLoaded.value = true;
// });
const canvas = ref<HTMLCanvasElement>();
async function redraw() {
  let promise: Promise<HTMLImageElement | undefined>;
  if (visualUrl.value && visual.value.url !== visualUrl.value) {
    const url = visualUrl.value;
    promise = new Promise((res) => {
      visual.value.url = visualUrl.value;
      visual.value.image = undefined;
      const image = new Image();
      image.src = url;
      image.addEventListener("load", () => {
        visual.value.image = image;
        res(image);
      });
    });
  } else {
    promise = Promise.resolve(visual.value.image);
  }
  const image = await promise;
  const cvs = canvas.value;
  const ctx = cvs?.getContext("2d");
  if (!cvs || !ctx || !image) return;
  const hRatio = cvs.width / image.width;
  const vRatio = cvs.height / image.height;
  const ratio = Math.min(hRatio, vRatio);
  const centerShift_x = (cvs.width - image.width * ratio) / 2;
  const centerShift_y = (cvs.height - image.height * ratio) / 2;
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  ctx.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    centerShift_x,
    centerShift_y,
    image.width * ratio,
    image.height * ratio
  );
  ctx.textAlign = "center";
  ctx.font = "50px Impacto";
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = 5;
  const top = incomingMove.value?.top;
  if (top) {
    ctx.strokeText(
      top.text.toUpperCase(),
      cvs.width / 2,
      75,
      image.width * ratio
    );
    ctx.fillText(
      top.text.toUpperCase(),
      cvs.width / 2,
      75,
      image.width * ratio
    );
  }
  const bottom = incomingMove.value?.bottom;
  if (bottom) {
    ctx.strokeText(
      bottom.text.toUpperCase(),
      cvs.width / 2,
      975,
      image.width * ratio
    );
    ctx.fillText(
      bottom.text.toUpperCase(),
      cvs.width / 2,
      975,
      image.width * ratio
    );
  }
}
watch(
  [
    canvas,
    () => incomingMove.value?.bottom,
    () => incomingMove.value?.top,
    hasLoaded,
  ],
  () => redraw()
);
</script>

<template>
  <div class="flex">
    <div class="m-8 flex flex-col max-w-[58rem]">
      <div class="flex flex-wrap"></div>
      <div class="flex flex-wrap py-8">
        <div class="h-16"></div>
      </div>
      <div class="flex space-x-2 overflow-x-auto overflow-y-visible">
        <div
          class="relative w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
          :class="{
            '-translate-y-2 bg-gray-100 dark:bg-gray-700':
              top === incomingMove?.top,
            'bg-gray-50 dark:bg-gray-800': top !== incomingMove?.top,
          }"
          v-for="top in hand.top"
          @click="() => updateIncomingMove('top', top)"
        >
          <span>{{ top.text }}</span>
          <span class="absolute text-xs right-2 bottom-2">{{ top.id }}</span>
        </div>
      </div>
      <div class="flex pt-4 space-x-2 overflow-x-auto overflow-y-visible">
        <div
          class="relative w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
          :class="{
            '-translate-y-2 bg-gray-100 dark:bg-gray-700':
              bottom === incomingMove?.bottom,
            'bg-gray-50 dark:bg-gray-800': bottom !== incomingMove?.bottom,
          }"
          v-for="bottom in hand.bottom"
          @click="() => updateIncomingMove('bottom', bottom)"
        >
          <span class="break-words">{{ bottom.text }}</span>
          <span class="absolute text-xs right-2 bottom-2">{{ bottom.id }}</span>
        </div>
      </div>
      <div class="w-[48rem] h-[48rem] flex justify-center items-center">
        <canvas
          ref="canvas"
          class="font-[Impacto] max-w-[48rem] max-h-[48rem]"
          height="1000"
          width="1000"
          >This no workey :(</canvas
        >
      </div>
      <div v-if="visualUrl" class="relative">
        <!-- <img
          :src="visualUrl"
          ref="visual"
          alt="The image currently displayed"
        /> -->
        <!-- <span
          class="absolute top-0 left-0 right-0 text-center font-[Impacto] text-4xl"
          v-if="incomingMove?.top"
          >{{ incomingMove.top.text }}</span
        >
        <span
          class="absolute bottom-0 left-0 right-0 text-center font-[Impacto] text-4xl"
          v-if="incomingMove?.bottom"
          >{{ incomingMove.bottom.text }}</span
        > -->
      </div>
      <!-- <pre>{{ stateText }}</pre> -->
      <!-- <div>
        <label
          for="colorBlindCheck"
          class="px-1 mr-2 font-serif border rounded-md"
        >
          T
        </label>
        <input
          type="checkbox"
          id="colorBlindCheck"
          v-model="store.settings.colorBlind"
        />
      </div> -->
    </div>
    <div class="flex flex-col w-0 h-0 m-8 scale-50"></div>
  </div>
</template>
