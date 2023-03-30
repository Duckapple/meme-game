<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { toggleConfetti } from "../confetti";
import { GameState, EndStandings, Standing } from "../model";

const props = defineProps<{
  standings: EndStandings;
  endGame?: () => void;
  username?: string;
}>();
function list(strs: string[]) {
  if (strs.length === 1) return strs[0];
  return strs.slice(0, strs.length - 1).join(", ") + " and " + strs.at(-1);
}
const showEndGame = ref(false);
const sortedStandings = computed(
  () => Object.entries(props.standings) as [Standing, EndStandings["1st"]][]
);
const bottomStandings = computed(() => sortedStandings.value.slice(3));
const revealed = ref<(string | null)[]>(
  sortedStandings.value.slice(0, 3).map(() => null)
);

watch(
  sortedStandings,
  (sortStand) => {
    const top = sortStand.slice(0, 3);
    top.reverse().forEach(([st, { players }], index) => {
      setTimeout(() => {
        revealed.value[revealed.value.length - index - 1] = list(players);
        if (index === revealed.value.length - 1) {
          setTimeout(() => {
            toggleConfetti();
            setTimeout(() => {
              showEndGame.value = true;
            }, 5000);
          }, 1000);
        }
      }, 3000 + 5000 * index);
    });
  },
  { immediate: true }
);
const hide = ref(false);
</script>

<template>
  <div
    class="text-white transition-opacity fade-in"
    :class="{ 'opacity-0': hide }"
  >
    <div
      class="fixed inset-0 z-40 transition-opacity bg-black opacity-60"
      :class="{ 'opacity-0': hide }"
    ></div>
    <div
      class="fixed inset-0 z-50 flex items-center justify-center transition-opacity"
      :class="{ 'opacity-0': hide }"
    >
      <div
        class="grid grid-cols-3 text-5xl text-center results w-[90%] 2xl:max-w-7xl"
      >
        <div class="p-4" />
        <div
          class="flex items-end justify-center p-4"
          :class="{ result: !!revealed[0] }"
        >
          {{ revealed[0] }}
        </div>
        <div class="p-4" />
        <div
          class="flex items-end justify-center p-4"
          :class="{ result: !!revealed[1] }"
        >
          {{ revealed[1] }}
        </div>
        <div class="p-4 text-6xl text-blue-800 bg-stone-400">1st</div>
        <div class="p-4" />
        <template v-if="revealed.length > 1">
          <div class="p-4 text-6xl text-blue-800 bg-stone-400">2nd</div>
          <div class="p-4 bg-stone-400"></div>
          <div
            class="flex items-end justify-center p-4"
            :class="{ result: !!revealed[2] }"
          >
            {{ revealed[2] }}
          </div>
        </template>
        <template v-if="revealed.length > 2">
          <div class="p-4 bg-stone-400"></div>
          <div class="p-4 bg-stone-400"></div>
          <div class="p-4 text-6xl text-blue-800 bg-stone-400">3rd</div>
        </template>
        <template
          v-if="sortedStandings.length > 3"
          v-for="[st, { players }] in bottomStandings"
        >
          <div class="pt-6 text-3xl" :class="{ 'opacity-0': !showEndGame }">
            {{ st }} :
          </div>
          <div
            class="col-span-2 p-4 text-left transition-opacity duration-500"
            :class="{ 'opacity-0': !showEndGame }"
          >
            {{ list(players) }}
          </div>
        </template>
        <div
          class="col-span-3 pt-4 text-sm transition-opacity text-stone-600 dark:text-stone-400"
          :class="{ 'opacity-0': !showEndGame }"
        >
          click and hold anywhere to hide results
        </div>
      </div>
    </div>
    <canvas
      class="z-[60] fixed inset-0"
      id="confetti-canvas"
      @pointerdown="() => (hide = true)"
      @pointerup="() => (hide = false)"
    ></canvas>
    <div
      class="z-[70] fixed inset-x-0 bottom-12 flex justify-center isolate text-2xl transition-opacity"
      :class="{
        'opacity-0': !showEndGame || hide,
        'opacity-100': showEndGame && !hide,
      }"
      v-if="endGame"
      @pointerup="() => (hide = false)"
    >
      <button @click="endGame" class="text-gray-900 btn dark:text-gray-200">
        <span class="block px-8 py-4 cursor-pointer">End Game</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.fade-in {
  animation: fade-in 1000ms;
}

@keyframes fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.result {
  animation: reveal 3000ms;
  transform: rotate(0) scaleX(1) scaleY(1);
}

@keyframes reveal {
  0% {
    transform: rotate(0) scaleX(0) scaleY(0);
  }
  25% {
    transform: rotate(12deg) scaleX(400%) scaleY(400%);
  }
  100% {
    transform: rotate(0) scaleX(1) scaleY(1);
  }
}
</style>
