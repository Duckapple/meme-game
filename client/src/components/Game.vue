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
  Blank,
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
  hand: Record<"top" | "bottom", (FullCard | Blank)[]>;
  players: string[];
  username: string;
  creator: string;
  settings: GameSettings;
  onMakeMove: MakeMoveFunction;
  onMakeLike: (index: number, state: boolean) => void;
  onDoneVoting: () => void;
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
    props.onMakeLike(i, likeState.value[i]);
  }, 50);
  like.value?.appendChild(likeSpan);
};

const incomingMove = ref<Partial<Move>>({ player: props.username });
const prevPhase = ref<GameState["phase"]>(props.state.phase);

const currentCard = ref(0);

const top = ref("");
const bottom = ref("");

watch(props, (p) => {
  if (prevPhase.value !== p.state.phase) {
    incomingMove.value = { player: p.username };
    likeState.value = props.players.map(() => false);
    currentCard.value = 0;
    prevPhase.value = p.state.phase;
    top.value = "";
    bottom.value = "";
  }
});

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

const onMakeMoveWithBlanks: MakeMoveFunction = (incomingMove) => {
  const actualMove = {
    top:
      incomingMove.top?.id === -1
        ? { id: -1, text: top.value }
        : incomingMove.top,
    bottom:
      incomingMove.bottom?.id === -1
        ? { id: -1, text: bottom.value }
        : incomingMove.bottom,
    player: incomingMove.player,
  };
  props.onMakeMove(actualMove);
};

const topBlankInput = ref();
const bottomBlankInput = ref();

const updateIncomingMove = <K extends keyof Move>(key: K, value: Move[K]) => {
  if (incomingMove.value[key] === value)
    return (incomingMove.value[key] = undefined);
  incomingMove.value[key] = value;
  if ((value as Move["top"])?.id === -1) {
    setTimeout(() => {
      if (key === "top") return topBlankInput.value?.focus();
      return bottomBlankInput.value?.focus();
    }, 100);
  }
};

const onArrow = (e: KeyboardEvent) => {
  if (props.state.phase === "vote") {
    if (["a", "d", "ArrowRight", "ArrowLeft", " "].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      switch (e.key) {
        case "a":
        case "ArrowRight":
          currentCard.value = (currentCard.value + 1) % props.players.length;
          return;
        case "d":
        case "ArrowLeft":
          currentCard.value =
            (currentCard.value > 0 ? currentCard.value : props.players.length) -
            1;
          return;
        case " ":
          const play = props.state.plays[currentCard.value];
          if (!play || play === "HIDDEN") return;
          play.player !== props.username && makeLike(currentCard.value);
          return;
      }
      return;
    }
  }
  // console.log(e.key);
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
  }, 250) as unknown as number; // Typing is Node rather than browser, huh
  window.addEventListener("keydown", onArrow);
  console.log("Game mounted!");
});
onUnmounted(() => {
  timerIntervalHandle.value && clearInterval(timerIntervalHandle.value);
  window.removeEventListener("keydown", onArrow);
  console.log("Game unmounted!");
});
const blank =
  "bg-gradient-to-br from-gray-200 to-sky-200 dark:from-gray-700 dark:to-sky-700";
const blankHighlit =
  "bg-gradient-to-br from-gray-300 to-sky-300 dark:from-gray-600 dark:to-sky-600";
</script>

<template>
  <div
    class="absolute inset-0 pb-16 sm:py-8 flex flex-col sm:flex-row justify-center max-w-[58rem] sm:max-w-none transition-[opacity transform] duration-500"
    :class="{ 'opacity-0 scale-0': state.phase !== 'move' }"
  >
    <div
      class="flex sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-auto min-h-[2rem] pl-4 pt-4"
    >
      <div
        v-for="top in hand.top"
        class="relative flex-shrink-0 p-2 transition border-2 rounded cursor-pointer h-28 w-52 hover:-translate-y-4 hover:-translate-x-4"
        :class="{
          '-translate-y-2 -translate-x-2 bg-gray-200 dark:bg-gray-700':
            top === incomingMove?.top,
          'bg-gray-50 dark:bg-gray-800': top !== incomingMove?.top,
          [blank]: top?.id === -1 && top !== incomingMove?.top,
          [blankHighlit]: top?.id === -1 && top === incomingMove?.top,
          disabled: isTzar || moveState,
        }"
        @click="() => !(isTzar || moveState) && updateIncomingMove('top', top)"
      >
        <span>{{ top.text ?? "________" }}</span>
        <span class="absolute text-xs right-2 bottom-2">{{ top.id }}</span>
      </div>
    </div>
    <div
      class="relative sm:w-[48rem] sm:h-[48rem] flex justify-center items-center py-2 sm:p-4"
    >
      <Meme
        v-if="props.state.visual"
        :bottom="
          incomingMove?.bottom?.id === -1
            ? { text: bottom }
            : incomingMove?.bottom
        "
        :top="incomingMove?.top?.id === -1 ? { text: top } : incomingMove?.top"
        :visual="props.state.visual"
        :image-mode="props.settings.imageMode"
        class="max-w-[48rem] max-h-[48rem]"
      />
      <input
        ref="topBlankInput"
        class="absolute sm:text-4xl text-center bg-transparent text-transparent top-3 sm:top-8 font-[Impacto] w-[90%] border-b-2 caret-white tracking-[0.2em] sm:tracking-wider"
        :value="top"
        :class="{ hidden: incomingMove.top?.id !== -1 || isTzar || moveState }"
        @input="(evt) => (top = (evt.target as any)?.value ?? '')"
      />
      <input
        ref="bottomBlankInput"
        class="absolute sm:text-4xl text-center bg-transparent text-transparent bottom-1 sm:bottom-8 font-[Impacto] w-[90%] border-b-2 caret-white tracking-[0.2em] sm:tracking-wider"
        :class="{
          hidden: incomingMove.bottom?.id !== -1 || isTzar || moveState,
        }"
        :value="bottom"
        @input="(evt) => (bottom = (evt.target as any)?.value ?? '')"
      />
    </div>
    <div
      class="flex sm:flex-col pt-4 pl-4 space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto overflow-y-visible min-h-[2rem]"
    >
      <div
        v-for="bottom in hand.bottom"
        class="relative flex-shrink-0 p-2 transition border-2 rounded cursor-pointer h-28 w-52 hover:-translate-y-4 hover:-translate-x-4"
        :class="{
          '-translate-y-2 -translate-x-2 bg-gray-200 dark:bg-gray-700':
            bottom === incomingMove?.bottom,
          'bg-gray-50 dark:bg-gray-800': bottom !== incomingMove?.bottom,
          [blank]: bottom?.id === -1 && bottom !== incomingMove?.bottom,
          [blankHighlit]: bottom?.id === -1 && bottom === incomingMove?.bottom,
          'disabled hover:translate-x-0 hover:translate-y-0':
            isTzar || moveState,
        }"
        @click="
          () => !(isTzar || moveState) && updateIncomingMove('bottom', bottom)
        "
      >
        <span class="break-words">{{ bottom.text ?? "________" }}</span>
        <span class="absolute text-xs right-2 bottom-2">{{ bottom.id }}</span>
      </div>
    </div>
    <button
      :class="{ disabled: isTzar || moveState }"
      class="absolute w-[calc(100%-2rem)] sm:w-auto btn left-4 right-4 sm:left-[unset] sm:right-[unset] bottom-2 sm:bottom-8"
      @click="
        () =>
          !(isTzar || moveState) &&
          moveLegal &&
          onMakeMoveWithBlanks(incomingMove)
      "
    >
      <span class="block px-8 py-4">{{
        isTzar ? "You're the Tzar!" : "Make Move"
      }}</span>
    </button>
  </div>
  <div
    v-if="state.visual"
    class="absolute inset-0 p-8 transition-[opacity transform] flex items-center justify-center w-full h-full duration-500 overflow-hidden"
    :class="{ 'opacity-0 scale-0': state.phase !== 'vote' }"
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
        :visual="state.visual"
        :class="narrowAxis"
        :image-mode="props.settings.imageMode"
        :style="staticHeight && { height: staticHeight + 'px' } /* FML */"
        @dblclick="play.player !== username && makeLike(i)"
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
      <button
        v-if="play && play != 'HIDDEN' && play.player !== username"
        class="absolute z-30 transition-transform scale-0 cursor-pointer select-none left-16 bottom-16 xl:left-1/4"
        :class="{ 'scale-[500%]': likeState[i] }"
        @click="play.player !== username && makeLike(i)"
      >
        ❤️
      </button>
      <button
        v-if="play && play != 'HIDDEN' && play.player !== username"
        class="absolute z-30 transition-transform scale-0 cursor-pointer select-none left-16 bottom-16 xl:left-1/4 text-shadow"
        :class="{ 'scale-[500%]': !likeState[i] }"
        @click="makeLike(i)"
      >
        🤍
      </button>
      <div
        v-if="play && play != 'HIDDEN' && play.player === username"
        class="absolute flex justify-center items-center inset-auto z-10 text-4xl md:text-8xl font-[Impacto] select-none"
      >
        <span class="p-6 text-white backdrop-blur backdrop-brightness-75"
          >This is your meme!</span
        >
      </div>
    </div>
    <div ref="like" class="z-10"></div>
    <button
      class="absolute top-0 bottom-0 left-0 z-20 w-16 text-5xl transition-opacity md:w-64 2xl:w-1/6 bg-gradient-to-r hover:dark:from-slate-800 hover:from-slate-100 text-shadow"
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
      class="absolute top-0 bottom-0 right-0 z-20 w-16 text-5xl transition-opacity md:w-64 2xl:w-1/6 bg-gradient-to-l hover:dark:from-slate-800 hover:from-slate-100 text-shadow"
      :class="{
        'opacity-0 cursor-default': currentCard >= players.length - 1,
        'opacity-50 hover:opacity-100': currentCard !== players.length - 1,
      }"
      @click="() => (currentCard = (currentCard + 1) % players.length)"
    >
      &gt;
    </button>
    <button
      class="absolute z-30 px-8 py-4 text-xl btn bottom-12 right-4 md:right-12"
      @click="onDoneVoting()"
    >
      Done voting
    </button>
  </div>
  <div
    v-if="state.visual"
    class="absolute inset-0 p-8 transition-[opacity transform] flex flex-col items-center justify-center w-full h-full duration-500 overflow-x-hidden overflow-y-scroll"
    :class="{ 'opacity-0 scale-0': state.phase !== 'standings' }"
  >
    <div
      v-if="state.standings"
      v-for="([move, pl, votes], i) in state.standings"
      class="relative"
    >
      <Meme
        :bottom="move?.bottom"
        :top="move?.top"
        :visual="state.visual"
        :image-mode="settings.imageMode"
      />
      <div class="flex justify-center">
        <span class="text-4xl">
          {{ move?.player }} - {{ votes }} votes<span
            v-if="!state.hasAnyoneWon"
          >
            - {{ state.points[pl] }} points</span
          >
        </span>
      </div>
      <span
        v-if="votes === state.standings[0][2]"
        class="absolute text-5xl select-none sm:text-9xl right-2 sm:right-4 bottom-8 sm:bottom-6 rotate-12"
        >🏆</span
      >
    </div>
  </div>
  <span
    v-if="timerNow"
    class="absolute sm:scale-[300%] right-4 sm:right-20 top-2 sm:top-16 z-30 text-3xl text-white text-shadow"
  >
    {{ Math.max(0, state.timerEnd - timerNow) }}
  </span>
</template>
