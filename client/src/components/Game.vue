<script lang="ts" setup>
import { computed, effect, ref } from "vue";
import { MakeMoveFunction } from "../App.vue";
import type { GameState, GameSettings, FullCard } from "../model";
import { store, visual_cdn } from "../state";
import TileGroup from "./TileGroup.vue";
import PlayerBoard from "./PlayerBoard.vue";
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
const stateText = computed(() => {
  return JSON.stringify({ ...props.state, hand: props.hand }, null, 2);
});
const visual = computed(() => {
  return props.state.visual ? visual_cdn.value + props.state.visual : undefined;
});
</script>

<template>
  <div class="flex">
    <div class="m-8 flex flex-col max-w-[58rem]">
      <div class="flex flex-wrap"></div>
      <div class="flex flex-wrap py-8">
        <div class="h-16"></div>
      </div>
      <img v-if="visual" :src="visual" alt="The image currently displayed" />
      <pre>{{ stateText }}</pre>
      <div>
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
      </div>
    </div>
    <div class="flex flex-col w-0 h-0 m-8 scale-50"></div>
  </div>
</template>
