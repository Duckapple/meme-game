<script lang="ts" setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { MakeMoveFunction } from "../App.vue";
import Meme from "./Meme.vue";
import type {
  GameState,
  GameSettings,
  FullCard,
  Move,
  MoveState,
} from "../model";

const narrowAxis = ref<"w-full" | "h-full">(
  window.innerWidth > window.innerHeight ? "h-full" : "w-full"
);
const staticHeight = ref<number | undefined>(
  window.innerHeight >= window.innerWidth ? window.innerWidth : undefined
);

window.addEventListener("resize", () => {
  narrowAxis.value =
    window.innerWidth > window.innerHeight ? "h-full" : "w-full";
  staticHeight.value =
    window.innerHeight >= window.innerWidth ? window.innerWidth : undefined;
});

const props = defineProps<{
  state: GameState;
  hand: Record<"top" | "bottom", FullCard[]>;
  players: string[];
  username: string;
  creator: string;
  settings: GameSettings;
  onMakeMove: MakeMoveFunction;
  moveState?: MoveState | null;
}>();

const likeState = ref(props.players.map(() => false));

const like = ref<HTMLDivElement>();
const makeLike = (i: number) => {
  const likeSpan = document.createElement("span");
  likeSpan.innerText = likeState.value[i] ? "💔" : "❤️";
  likeSpan.setAttribute("style", "user-select: none");
  likeSpan.className = "block transition-transform scale-0";
  setTimeout(() => {
    likeSpan.className =
      "block transition-[transform opacity] duration-500 scale-[2000%]";
    setTimeout(() => {
      likeSpan.className =
        "block transition-[transform opacity] duration-500 opacity-0 scale-[1500%]";
      setTimeout(() => {
        like.value?.removeChild(likeSpan);
      }, 400);
    }, 500);
    likeState.value[i] = !likeState.value[i];
  }, 50);
  like.value?.appendChild(likeSpan);
};

const incomingMove = ref<Partial<Move>>({ player: props.username });

watch(props, (p) => {
  if (p.moveState === null) incomingMove.value = { player: p.username };
});

const currentCard = ref(0);

const touchStartX = ref<number>();
const touchMoved = ref(false);

const touchSwipe = (e: TouchEvent) => {
  if (e.touches.length !== 1) return;
  if (touchStartX.value == null) {
    touchStartX.value = e.touches.item(0)?.clientX;
    return;
  }
  const dTouch = touchStartX.value - (e.touches.item(0)?.clientX ?? 0);
  if (Math.abs(dTouch) <= 50 || touchMoved.value) return;
  let cc = currentCard.value;
  if (dTouch > 0) {
    currentCard.value = (cc + 1) % props.players.length;
  } else {
    currentCard.value = (cc > 0 ? cc : props.players.length) - 1;
  }
  touchMoved.value = true;
};

const updateIncomingMove = <K extends keyof Move>(key: K, value: Move[K]) => {
  if (incomingMove.value[key] === value)
    return (incomingMove.value[key] = undefined);
  incomingMove.value[key] = value;
};

const moveLegal = computed(
  () =>
    (props.settings.canOmit.top || incomingMove.value?.top) &&
    (props.settings.canOmit.bottom || incomingMove.value?.bottom)
);

const stateText = computed(() => {
  return JSON.stringify({ ...props.state, hand: props.hand }, null, 2);
});
const isTzar = computed(
  () => props.players[props.state.currentTzar] === props.username
);
const timerNow = ref<number>();
const timerIntervalHandle = ref<number>();
onMounted(() => {
  timerIntervalHandle.value = setInterval(() => {
    timerNow.value = Math.round(new Date().getTime() / 1000);
  }, 250) as unknown as number; // Typing is just wrong, wow
});
onUnmounted(() => {
  timerIntervalHandle.value && clearInterval(timerIntervalHandle.value);
});
</script>

<template>
  <div
    class="absolute inset-0 p-8 flex flex-col max-w-[58rem] transition-[opacity transform] duration-500"
    :class="{ 'opacity-0 scale-0': state.tzarsTurn }"
  >
    <div class="flex space-x-2 overflow-x-auto overflow-y-visible">
      <div
        v-for="top in hand.top"
        class="relative flex-shrink-0 w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
        :class="{
          '-translate-y-2 bg-gray-100 dark:bg-gray-700':
            top === incomingMove?.top,
          'bg-gray-50 dark:bg-gray-800': top !== incomingMove?.top,
          disabled: isTzar || moveState,
        }"
        @click="() => !(isTzar || moveState) && updateIncomingMove('top', top)"
      >
        <span>{{ top.text }}</span>
        <span class="absolute text-xs right-2 bottom-2">{{ top.id }}</span>
      </div>
    </div>
    <div class="flex pt-4 space-x-2 overflow-x-auto overflow-y-visible">
      <div
        v-for="bottom in hand.bottom"
        class="relative flex-shrink-0 w-32 p-2 transition border-2 rounded cursor-pointer h-52 hover:-translate-y-4"
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
      <Meme
        v-if="props.state.visual"
        :bottom="incomingMove?.bottom"
        :top="incomingMove?.top"
        :visual="props.state.visual"
        class="max-w-[48rem] max-h-[48rem]"
      />
    </div>
    <button
      :class="{ disabled: isTzar || moveState }"
      class="btn"
      @click="
        () => !(isTzar || moveState) && moveLegal && onMakeMove(incomingMove)
      "
    >
      <span class="block px-8 py-4">{{
        isTzar ? "You're the Tzar!" : "Make Move"
      }}</span>
    </button>
  </div>
  <div
    v-if="props.state.visual"
    class="absolute inset-0 p-8 transition-[opacity transform] flex items-center justify-center w-full h-full duration-500 overflow-hidden"
    :class="{ 'opacity-0 scale-0': !state.tzarsTurn }"
  >
    <div
      v-for="(play, i) in state.plays"
      class="absolute inset-0 flex items-center justify-center w-full h-full transition-transform duration-500"
      :class="{
        '-translate-x-full': currentCard > i,
        'translate-x-full': currentCard < i,
      }"
    >
      <Meme
        v-if="play && play != 'HIDDEN'"
        :top="play.top"
        :bottom="play.bottom"
        :visual="props.state.visual"
        :class="narrowAxis"
        :style="staticHeight && { height: staticHeight + 'px' } /* FML */"
        @dblclick="makeLike(i)"
        @touchmove="(e) => touchSwipe(e)"
        @touchend="
          () => {
            touchMoved = false;
            touchStartX = undefined;
          }
        "
      />
      <span
        v-else
        class="text-3xl text-gray-500 select-none md:text-7xl -rotate-12"
      >
        Nothing to see here...
      </span>
      <span
        class="absolute transition-transform scale-0 left-16 bottom-16 2xl:left-1/4"
        :class="{ 'scale-[500%]': likeState[i] }"
      >
        ❤️
      </span>
    </div>
    <div ref="like" class="z-10"></div>
    <button
      class="absolute top-0 bottom-0 left-0 w-16 text-5xl transition-opacity md:w-64 2xl:w-1/6 bg-gradient-to-r hover:dark:from-slate-800 hover:from-slate-100 text-shadow"
      :class="{
        'opacity-0 cursor-default': currentCard === 0,
        'opacity-50 hover:opacity-100': currentCard !== 0,
      }"
      @click="
        () =>
          (currentCard = (currentCard > 0 ? currentCard : players.length) - 1)
      "
    >
      &lt;
    </button>
    <button
      class="absolute top-0 bottom-0 right-0 w-16 text-5xl transition-opacity md:w-64 2xl:w-1/6 bg-gradient-to-l hover:dark:from-slate-800 hover:from-slate-100 text-shadow"
      :class="{
        'opacity-0 cursor-default': currentCard >= players.length - 1,
        'opacity-50 hover:opacity-100': currentCard !== players.length - 1,
      }"
      @click="() => (currentCard = (currentCard + 1) % players.length)"
    >
      &gt;
    </button>
  </div>
  <span
    v-if="timerNow"
    class="absolute scale-[300%] right-16 top-16 2xl:right-1/4 text-3xl text-shadow"
  >
    {{ Math.max(0, state.timerEnd - timerNow) }}
  </span>
</template>
