<script lang="ts" setup>
import { store, username, UUID, roomDetails } from "../state";
import { mountSubscriptions, subscriptions, ws } from "../comms";
import { ref, onMounted, onUnmounted, watch } from "vue";
import { MessageType } from "../model";
const isDebug = store.settings.debug || false;
const showDebug = ref(false);

const pre = ref<HTMLPreElement>();
const input = ref<HTMLInputElement>();

const value = ref<string>();

const event = (e: KeyboardEvent) => {
  if (e.isComposing || !isDebug) return;
  if (e.ctrlKey && e.key === "`") {
    e.preventDefault();
    showDebug.value = !showDebug.value;
  }
};
onMounted(() => {
  document.addEventListener("keydown", event);
});
onUnmounted(() => {
  document.removeEventListener("keydown", event);
});

watch(showDebug, () => {
  if (showDebug.value) {
    input.value?.focus();
  } else {
    input.value?.blur();
  }
});

// Dummy string to ensure text colors are included in the output.
const colors = "text-red-500 text-blue-500 text-green-500 text-yellow-500";

const lines = ref<(string | { class?: string; text: string }[])[]>([
  "Welcome to the Debug Console!",
  // 'Type "help" for a list of commands.',
]);

subscriptions.push([
  "message",
  (e) => {
    if (!("data" in e) || typeof e.data !== "string") return;
    lines.value.push([
      { class: "text-green-500", text: "server" },
      { text: "> " },
      { class: "text-yellow-500", text: e.data },
    ]);
  },
]);

mountSubscriptions();

const handleSend = (msgType: string, json: Record<string, any>) => {
  if (!(msgType in MessageType)) {
    lines.value.push([{ class: "text-red-500", text: "Invalid message type" }]);
    return;
  }
  ws.value.send(
    JSON.stringify({
      username: username.value,
      userID: UUID.value,
      roomID: roomDetails.value?.roomID,
      ...json,
      type: msgType,
    })
  );
};

const handleLookup = (elementType: string, data: any) => {
  if (!["bottom", "top", "visual"].includes(elementType)) {
    lines.value.push([{ class: "text-red-500", text: "Invalid element type" }]);
    return;
  }
  if (elementType === "visual") {
    lines.value.push([
      { class: "text-red-500", text: "Not supported yet lol" },
    ]);
  } else {
    ws.value.send(
      JSON.stringify({
        type: MessageType.LOOKUP,
        elementType,
        data: data ?? {},
      })
    );
  }
};

const onEnter = (e: KeyboardEvent) => {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  if (value.value) {
    lines.value.push([
      { text: "> " },
      ...value.value.split(" ").map((text) => ({
        text: text + " ",
        class: text === "send" ? "text-blue-500" : undefined,
      })),
    ]);
    if (value.value.startsWith("send ")) {
      const [_, type, ...json] = value.value.split(" ");
      try {
        let parsed = JSON.parse(json.join(" "));
        handleSend(type, parsed);
      } catch {
        lines.value.push([{ class: "text-red-500", text: "Wrong JSON" }]);
      }
    } else if (value.value.startsWith("lookup ")) {
      const [_, type, ...json] = value.value.split(" ");
      try {
        let parsed: any;
        parsed = json.length > 0 ? JSON.parse(json.join(" ")) : undefined;
        handleLookup(type, parsed);
      } catch {
        lines.value.push([{ class: "text-red-500", text: "Wrong JSON" }]);
      }
    }
    requestAnimationFrame(() => {
      pre.value && (pre.value.scrollTop = pre.value.scrollHeight);
    });
    value.value = undefined;
  }
};

requestAnimationFrame(() => {
  pre.value && (pre.value.scrollTop = pre.value.scrollHeight);
});
</script>

<template>
  <div
    v-if="isDebug"
    class="px-2 pt-2 absolute inset-x-0 top-0 transition-transform -translate-y-full z-[100] backdrop-blur"
    :class="{ 'translate-y-0': showDebug }"
  >
    <div ref="pre" class="flex flex-col overflow-y-auto font-mono h-60">
      <span v-for="line in lines">
        <template v-if="typeof line === 'string'">
          {{ line }}
        </template>
        <template v-else>
          <template v-for="part in line">
            <span :class="part.class">{{ part.text }}</span>
          </template>
        </template>
        {{ "\n" }}
      </span>
    </div>
    <div
      class="flex font-mono border-t border-b border-black dark:border-white"
    >
      <span>>&nbsp;</span>
      <input
        ref="input"
        type="text"
        name="command"
        id="command"
        placeholder="Type command..."
        v-model="value"
        @keypress="onEnter"
      />
    </div>
  </div>
</template>

<style scoped>
input {
  @apply inline bg-transparent grow focus-visible:outline-none;
}
</style>
