<script lang="ts" setup>
import { computed, effect, ref } from "vue";
import { MakeMoveFunction } from "../App.vue";
import { GameState, GameSettings } from "../model";
import { store } from "../state";
import TileGroup from "./TileGroup.vue";
import PlayerBoard from "./PlayerBoard.vue";
import Tile from "./Tile.vue";
import { mapValues } from "lodash";
import { setTitle } from "../title";

const props = defineProps<{
  state: GameState;
  players: string[];
  username: string;
  creator: string;
  settings: GameSettings;
  // onMakeMove: MakeMoveFunction;
}>();
const stateText = computed(() => {
  return JSON.stringify(props.state, null, 2);
});
</script>

<template>
  <div class="flex">
    <div class="m-8 flex flex-col max-w-[58rem]">
      <div class="flex flex-wrap"></div>
      <div class="flex flex-wrap py-8">
        <div class="h-16"></div>
      </div>
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
