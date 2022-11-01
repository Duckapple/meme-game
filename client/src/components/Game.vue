<script lang="ts" setup>
import { computed, ref } from "vue";
import { MakeMoveFunction } from "../App.vue";
import Meme from "./Meme.vue";
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
        <Meme
          v-if="props.state.visual"
          :bottom="incomingMove?.bottom"
          :top="incomingMove?.top"
          :visual="props.state.visual"
        />
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
