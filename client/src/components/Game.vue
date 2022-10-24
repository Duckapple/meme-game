<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { MakeMoveFunction } from "../App.vue";
import type {
  GameState,
  GameSettings,
  FullCard,
  Move,
  MoveState,
} from "../model";
import { visual_cdn } from "../state";

const props = defineProps<{
  state: GameState;
  hand: Record<"top" | "bottom", FullCard[]>;
  players: string[];
  username: string;
  creator: string;
  settings: GameSettings;
  onMakeMove: MakeMoveFunction;
  moveState?: MoveState;
}>();

const CANVAS_SIZE = 1000;

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
const isTzar = computed(
  () => props.players[props.state.currentTzar] === props.username
);
const visualUrl = computed(() => {
  return props.state.visual ? visual_cdn.value + props.state.visual : undefined;
});
const visual = ref<{ image?: HTMLImageElement; url?: string }>({});
const hasLoaded = ref(false);

const canvas = ref<HTMLCanvasElement>();
async function redraw() {
  let promise: Promise<HTMLImageElement | any | undefined>;
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
  ctx.font = `${CANVAS_SIZE / 20}px Impacto`;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = CANVAS_SIZE / 200;
  const top = incomingMove.value?.top;
  if (top) {
    ctx.strokeText(
      top.text.toUpperCase(),
      cvs.width / 2,
      (1.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
    );
    ctx.fillText(
      top.text.toUpperCase(),
      cvs.width / 2,
      (1.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
    );
  }
  const bottom = incomingMove.value?.bottom;
  if (bottom) {
    ctx.strokeText(
      bottom.text.toUpperCase(),
      cvs.width / 2,
      CANVAS_SIZE - (0.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
    );
    ctx.fillText(
      bottom.text.toUpperCase(),
      cvs.width / 2,
      CANVAS_SIZE - (0.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
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
    <div class="p-8 flex flex-col max-w-[58rem]">
      <div class="flex flex-wrap"></div>
      <div class="flex space-x-2 overflow-x-auto overflow-y-visible">
        <div
          v-for="top in hand.top"
          class="relative w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
          :class="{
            '-translate-y-2 bg-gray-100 dark:bg-gray-700':
              top === incomingMove?.top,
            'bg-gray-50 dark:bg-gray-800': top !== incomingMove?.top,
            disabled: isTzar || moveState,
          }"
          @click="
            () => !(isTzar || moveState) && updateIncomingMove('top', top)
          "
        >
          <span>{{ top.text }}</span>
          <span class="absolute text-xs right-2 bottom-2">{{ top.id }}</span>
        </div>
      </div>
      <div class="flex pt-4 space-x-2 overflow-x-auto overflow-y-visible">
        <div
          v-for="bottom in hand.bottom"
          class="relative w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
          :class="{
            '-translate-y-2 bg-gray-100 dark:bg-gray-700':
              bottom === incomingMove?.bottom,
            'bg-gray-50 dark:bg-gray-800': bottom !== incomingMove?.bottom,
            disabled: isTzar || moveState,
          }"
          @click="
            () => !(isTzar || moveState) && updateIncomingMove('bottom', bottom)
          "
        >
          <span class="break-words">{{ bottom.text }}</span>
          <span class="absolute text-xs right-2 bottom-2">{{ bottom.id }}</span>
        </div>
      </div>
      <div class="w-[48rem] h-[48rem] flex justify-center items-center">
        <canvas
          ref="canvas"
          class="font-[Impacto] max-w-[48rem] max-h-[48rem]"
          :height="CANVAS_SIZE"
          :width="CANVAS_SIZE"
        >
          This no workey :(
        </canvas>
      </div>
      <button
        :class="{ disabled: isTzar || moveState }"
        class="btn"
        @click="
          () =>
            !(isTzar || moveState) && incomingMove && onMakeMove(incomingMove)
        "
      >
        <span class="block px-8 py-4">{{
          isTzar ? "You're the Tzar!" : "Make Move"
        }}</span>
      </button>
    </div>
    <div class="flex flex-col w-0 h-0 m-8 scale-50"></div>
  </div>
</template>
