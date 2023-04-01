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
  Hidden,
} from "../model";
import { store } from "../state";

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
  onNextTurn: () => void;
  moveState?: MoveState | null;
}>();

const likeState = ref(props.players.map(() => false));
const saveState = ref(props.players.map(() => false));
const makeSave = (i: number, play: Move) => {
  saveState.value[i] = !saveState.value[i];
  if (saveState.value[i] && props.state.visual) {
    store.savedMemes.push({
      visual: props.state.visual,
      ...play,
    });
  } else {
    const index = store.savedMemes.findIndex(
      ({ visual, bottom, top }) =>
        visual === props.state.visual &&
        bottom?.text === play.bottom?.text &&
        top?.text === play.top?.text
    );
    index !== -1 && store.savedMemes.splice(index, 1);
  }
};

const like = ref<HTMLDivElement>();
const makeLike = (i: number, play: Move) => {
  makeSave(i, play);
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
    saveState.value = props.players.map(() => false);
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

const realPlays = computed(() =>
  props.state.plays
    .map((x, i) => [x, i] as const)
    .filter((x): x is [Move | Hidden, number] => !!x[0])
);

const onArrow = (e: KeyboardEvent) => {
  if (props.state.phase === "vote") {
    if (["a", "d", "ArrowRight", "ArrowLeft", " "].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      switch (e.key) {
        case "a":
        case "ArrowRight":
          currentCard.value = (currentCard.value + 1) % realPlays.value.length;
          return;
        case "d":
        case "ArrowLeft":
          currentCard.value =
            (currentCard.value > 0
              ? currentCard.value
              : realPlays.value.length) - 1;
          return;
        case " ":
          const play = props.state.plays[currentCard.value];
          if (!play || play === "HIDDEN") return;
          play.player !== props.username && makeLike(currentCard.value, play);
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
    class="absolute inset-0 pb-16 xl:py-8 flex flex-col xl:flex-row items-center xl:items-top justify-center max-w-[58rem] xl:max-w-none transition-[opacity transform] duration-500"
    :class="{ 'opacity-0 scale-0': state.phase !== 'move' }"
  >
    <div
      class="flex xl:flex-col space-x-2 xl:space-x-0 xl:space-y-2 overflow-auto min-h-[2rem] pl-4 pt-4 max-w-full"
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
      class="relative max-w-full sm:w-[36rem] md:w-[48rem] sm:h-[36rem] md:h-[48rem] flex justify-center items-center py-2 xl:p-4"
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
        class="w-full max-w-[48rem] max-h-[48rem]"
      />
      <input
        ref="topBlankInput"
        class="absolute xl:text-4xl text-center bg-transparent text-transparent top-3 xl:top-8 font-[Impacto] w-[90%] border-b-2 caret-white tracking-[0.2em] xl:tracking-wider"
        :value="top"
        :class="{ hidden: incomingMove.top?.id !== -1 || isTzar || moveState }"
        @input="(evt) => (top = (evt.target as any)?.value ?? '')"
      />
      <input
        ref="bottomBlankInput"
        class="absolute xl:text-4xl text-center bg-transparent text-transparent bottom-1 xl:bottom-8 font-[Impacto] w-[90%] border-b-2 caret-white tracking-[0.2em] xl:tracking-wider"
        :class="{
          hidden: incomingMove.bottom?.id !== -1 || isTzar || moveState,
        }"
        :value="bottom"
        @input="(evt) => (bottom = (evt.target as any)?.value ?? '')"
      />
    </div>
    <div
      class="flex xl:flex-col pt-4 pl-4 space-x-2 xl:space-x-0 xl:space-y-2 overflow-x-auto overflow-y-visible min-h-[2rem] max-w-full"
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
      class="absolute w-[calc(100%-2rem)] xl:w-auto btn left-4 right-4 xl:left-[unset] xl:right-[unset] bottom-2 xl:bottom-8"
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
      v-for="([play, realIndex], i) in realPlays"
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
        @dblclick="play.player !== username && makeLike(realIndex, play)"
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
        class="absolute z-30 text-red-500 transition-transform scale-0 cursor-pointer select-none left-8 sm:left-16 bottom-1/4 sm:bottom-16 2xl:left-1/4"
        :class="{
          'scale-[200%] sm:scale-[300%] md:scale-[400%]': likeState[realIndex],
        }"
        @click="play.player !== username && makeLike(realIndex, play)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 48 48"
        >
          <mask id="ipSLike0">
            <path
              fill="#fff"
              stroke="#fff"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="4"
              d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A10.987 10.987 0 0 0 15 8Z"
            />
          </mask>
          <path fill="currentColor" d="M0 0h48v48H0z" mask="url(#ipSLike0)" />
        </svg>
      </button>
      <button
        v-if="play && play != 'HIDDEN' && play.player !== username"
        class="absolute z-30 text-red-500 transition-transform scale-0 cursor-pointer select-none left-8 sm:left-16 bottom-1/4 sm:bottom-16 2xl:left-1/4"
        :class="{
          'scale-[200%] sm:scale-[300%] md:scale-[400%]': !likeState[realIndex],
        }"
        @click="makeLike(realIndex, play)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 48 48"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="4"
            d="M15 8C8.925 8 4 12.925 4 19c0 11 13 21 20 23.326C31 40 44 30 44 19c0-6.075-4.925-11-11-11c-3.72 0-7.01 1.847-9 4.674A10.987 10.987 0 0 0 15 8Z"
          />
        </svg>
      </button>
      <button
        v-if="play && play != 'HIDDEN' && play.player === username"
        class="absolute z-30 text-yellow-600 transition-transform scale-0 cursor-pointer select-none right-8 top-1/4 sm:right-16 sm:top-16 2xl:right-1/4"
        :class="{
          'scale-[200%] sm:scale-[300%] md:scale-[400%]': saveState[realIndex],
        }"
        @click="makeSave(realIndex, play)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 48 48"
        >
          <mask id="ipSStar0">
            <path
              fill="#fff"
              stroke="#fff"
              stroke-linejoin="round"
              stroke-width="4"
              d="m23.999 5l-6.113 12.478L4 19.49l10.059 9.834L11.654 43L24 36.42L36.345 43L33.96 29.325L44 19.491l-13.809-2.013L24 5Z"
            />
          </mask>
          <path fill="currentColor" d="M0 0h48v48H0z" mask="url(#ipSStar0)" />
        </svg>
      </button>
      <button
        v-if="play && play != 'HIDDEN' && play.player === username"
        class="absolute z-30 text-yellow-600 transition-transform scale-0 cursor-pointer select-none right-8 top-1/4 sm:right-16 sm:top-16 2xl:right-1/4"
        :class="{
          'scale-[200%] sm:scale-[300%] md:scale-[400%]': !saveState[realIndex],
        }"
        @click="makeSave(realIndex, play)"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="48"
          height="48"
          viewBox="0 0 48 48"
        >
          <path
            fill="none"
            stroke="currentColor"
            stroke-linejoin="round"
            stroke-width="4"
            d="m23.999 5l-6.113 12.478L4 19.49l10.059 9.834L11.654 43L24 36.42L36.345 43L33.96 29.325L44 19.491l-13.809-2.013L24 5Z"
          />
        </svg>
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
          (currentCard = (currentCard > 0 ? currentCard : realPlays.length) - 1)
      "
    >
      &lt;
    </button>
    <button
      class="absolute top-0 bottom-0 right-0 z-20 w-16 text-5xl transition-opacity md:w-64 2xl:w-1/6 bg-gradient-to-l hover:dark:from-slate-800 hover:from-slate-100 text-shadow"
      :class="{
        'opacity-0 cursor-default': currentCard >= realPlays.length - 1,
        'opacity-50 hover:opacity-100': currentCard !== realPlays.length - 1,
      }"
      @click="() => (currentCard = (currentCard + 1) % realPlays.length)"
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
    class="absolute left-auto right-auto top-0 p-2 sm:p-0 transition-[opacity transform] grid sm:grid-cols-2 overflow-x-hidden overflow-y-scroll lg:px-20 xl:px-32 2xl:px-40 4xl:p-4"
    :class="{ 'opacity-0 scale-0': state.phase !== 'standings' }"
  >
    <div
      v-if="state.standings"
      v-for="([move, pl, votes], i) in state.standings.filter(([x]) => x)"
      class="relative pb-2 sm:p-4"
    >
      <Meme
        :bottom="move?.bottom"
        :top="move?.top"
        :visual="state.visual"
        :image-mode="settings.imageMode"
      />
      <div class="flex justify-center pt-2">
        <span class="text-4xl">
          {{ move?.player }} - {{ votes }}&nbsp;votes<span
            v-if="!state.hasAnyoneWon"
          >
            - {{ state.points[pl] }}&nbsp;points</span
          >
        </span>
      </div>
      <span
        v-if="votes === state.standings[0][2]"
        class="absolute text-6xl select-none sm:text-9xl right-2 sm:right-4 bottom-8 sm:bottom-6 rotate-12"
        >🏆</span
      >
    </div>
    <button
      class="fixed px-4 py-2 lg:px-8 lg:py-4 lg:text-xl right-4 bottom-4 btn"
      v-if="creator === username"
      @click="onNextTurn"
    >
      Continue to next turn
    </button>
  </div>
  <span
    v-if="timerNow"
    class="absolute lg:scale-[300%] right-4 lg:right-20 top-2 lg:top-16 z-30 text-3xl text-white text-shadow"
  >
    {{ Math.max(0, state.timerEnd - timerNow) }}
  </span>
</template>
