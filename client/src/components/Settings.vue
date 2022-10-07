<script lang="ts" setup>
import { GameSettings } from "../model";

const props = defineProps<{
  settings: GameSettings;
  isCreator: boolean;
  onChanged: () => void;
}>();

const setKey = (key: "handSize" | "discardsPerRound", e: Event) => {
  const val = Number((e.target as HTMLInputElement).value);
  if (!isNaN(val)) props.settings[key] = val;
};
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
  <div class="flex items-center pt-4">
    <label for="toptext">Can omit top text?</label>
    <input
      type="checkbox"
      name="toptext"
      id="toptext"
      v-model="settings.canOmit.top"
    />
  </div>
  <div class="flex items-center pt-2">
    <label for="bottomtext">Can omit bottom text?</label>
    <input
      type="checkbox"
      name="bottomtext"
      id="bottomtext"
      v-model="settings.canOmit.bottom"
    />
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
