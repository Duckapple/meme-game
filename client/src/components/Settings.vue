<script lang="ts" setup>
import { computed } from "vue";
import { GameSettings } from "../model";

const legibleOptions: Record<GameSettings["winCondition"]["type"], string> = {
  points: "First to",
  rounds: "Best of",
};

const parse = (e: Event): number | null => {
  const val = Number((e.target as HTMLInputElement).value);
  if (isNaN(val)) return null;
  return val;
};

const props = defineProps<{
  settings: GameSettings;
  isCreator: boolean;
  onChanged: () => void;
}>();

const setKey = (key: "handSize" | "discardsPerRound", e: Event) => {
  const val = parse(e);
  if (val) props.settings[key] = val;
};

const textForOmitOptions = computed(() => {
  const top = props.settings.canOmit.top;
  const bottom = props.settings.canOmit.bottom;
  if (top && bottom) return "Can omit any text";
  if (top) return "Can only omit top text";
  if (bottom) return "Can only omit bottom text";
  return "Cannot omit text";
});
</script>

<template>
  <table>
    <tr>
      <td>
        <span>Hand Size:</span>
        <input
          v-if="isCreator"
          :value="settings.handSize"
          @input="(e) => setKey('handSize', e)"
        />
        <span v-if="!isCreator" class="mr-0">
          {{ settings.handSize }}
        </span>
      </td>
      <td>
        <span>Discards per round:</span>
        <input
          v-if="isCreator"
          :value="settings.discardsPerRound"
          @input="(e) => setKey('discardsPerRound', e)"
        />
        <span v-if="!isCreator" class="mr-0">
          {{ settings.discardsPerRound }}
        </span>
      </td>
      <!-- <td>
        <span>All Color Points:</span>
        <input
          v-if="isCreator"
          :value="settings.pointRewards.color"
          @input="(e) => setReward(e, 'color')"
        />
        <span v-if="!isCreator" class="mr-0">
          {{ settings.pointRewards.color }}
        </span>
      </td> -->
    </tr>
    <!-- <tr>
      <td class="w-full">
        <span>Penalty Points</span>
        <input
          v-if="isCreator"
          v-for="(penalty, i) in settings.pointPenalties"
          :value="penalty"
          @input="(e) => setPenalty(e, i)"
        />
        <span
          v-if="!isCreator"
          v-for="(penalty, i) in settings.pointPenalties"
          :class="{ 'mr-0': i === settings.pointPenalties.length - 1 }"
        >
          {{ penalty }}
        </span>
      </td>
    </tr> -->
  </table>
  <div class="flex items-center pt-4" v-if="isCreator">
    <label for="toptext">Can omit top text?</label>
    <input
      type="checkbox"
      name="toptext"
      id="toptext"
      v-model="settings.canOmit.top"
    />
  </div>
  <div class="flex items-center pt-2" v-if="isCreator">
    <label for="bottomtext">Can omit bottom text?</label>
    <input
      type="checkbox"
      name="bottomtext"
      id="bottomtext"
      v-model="settings.canOmit.bottom"
    />
  </div>
  <div v-if="!isCreator">
    <span>{{ textForOmitOptions }}</span>
  </div>
  <div>
    <label>Win condition: </label>

    <select
      v-if="isCreator"
      v-model="settings.winCondition.type"
      class="px-2 py-1 mr-2 bg-transparent border-2 dark:border-white"
    >
      <option value="points">{{ legibleOptions["points"] }}</option>
      <option value="rounds">{{ legibleOptions["rounds"] }}</option>
    </select>
    <span v-if="!isCreator">{{
      legibleOptions[settings.winCondition.type]
    }}</span>

    <input
      v-if="isCreator"
      name="win-n"
      id="win-n"
      @input="
        (e) => {
          if (parse(e))
            settings.winCondition.n = parse(e) as number;
        }
      "
      :value="settings.winCondition.n"
    />
    <span v-if="!isCreator">&nbsp;{{ settings.winCondition.n }}</span>

    {{ settings.winCondition.type }}
  </div>
</template>

<style scoped>
table {
  @apply w-full;
}
tr {
  @apply border-x-2 border-t-2 w-full flex;
}
tr:last-child {
  @apply border-b-2;
}
td {
  @apply px-4 h-14 flex items-center justify-between grow;
}
td:not(:last-child) {
  @apply border-r-2;
}
td > span {
  @apply mr-4;
}
td > span.mr-0 {
  margin-right: 0;
}
input {
  @apply bg-transparent w-10 text-end;
}
</style>
