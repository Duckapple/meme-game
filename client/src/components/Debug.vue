<script lang="ts" setup>
import { store, username, UUID, roomDetails } from "../state";
import { mountSubscriptions, subscriptions, ws } from "../comms";
import { ref, onMounted, onUnmounted, watch } from "vue";
import { MessageType, Highlight } from "../model";
const isDebug = store.settings.debug || false;
const props = defineProps<{ showDebug: boolean; toggleDebug: () => void }>();

const pre = ref<HTMLPreElement>();
const input = ref<HTMLInputElement>();

const value = ref<string>();
const oldValues = ref<string[]>([]);
const oldValueIndex = ref(0);

const event = (e: KeyboardEvent) => {
  if (e.isComposing || !isDebug) return;
  if (e.ctrlKey && e.key === "`") {
    e.preventDefault();
    props.toggleDebug();
  }
};
onMounted(() => {
  document.addEventListener("keydown", event);
});
onUnmounted(() => {
  document.removeEventListener("keydown", event);
});

watch(props, () => {
  if (props.showDebug) {
    input.value?.focus();
  } else {
    input.value?.blur();
  }
});

const c = {
  red: (text: string) => ({ text, class: "text-red-500" }),
  blue: (text: string) => ({ text, class: "text-blue-500" }),
  green: (text: string) => ({ text, class: "text-green-500" }),
  yellow: (text: string) => ({ text, class: "text-yellow-500" }),
};

const lines = ref<(string | { class?: string; text: string }[])[]>([
  "Welcome to the Debug Console!",
  // 'Type "help" for a list of commands.',
]);

const err = (text: string) => {
  lines.value.push([c.red(text)]);
};

const pushToEnd = () => {
  requestAnimationFrame(() => {
    pre.value && (pre.value.scrollTop = pre.value.scrollHeight);
  });
};

subscriptions.push([
  "message",
  (e: any) => {
    if (!("data" in e)) return;
    if (typeof (e as any).data !== "string") return;
    lines.value.push([
      { class: "text-green-500", text: "server" },
      { text: "> " },
      { class: "text-yellow-500", text: e.data },
    ]);
    pushToEnd();
  },
]);

mountSubscriptions();

const handleSend = (msgType: string, json: Record<string, any>) => {
  msgType = msgType.toUpperCase();
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
    lines.value.push([c.red("Invalid element type")]);
    return;
  }
  if (elementType === "visual") {
    lines.value.push([c.red("Not supported yet lol")]);
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

const onArrows = (e: KeyboardEvent) => {
  if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
  e.preventDefault();
  if (e.key === "ArrowUp" && oldValueIndex.value > 0) {
    oldValueIndex.value--;
    value.value = oldValues.value[oldValueIndex.value];
  }
  if (e.key === "ArrowDown" && oldValueIndex.value < oldValues.value.length) {
    oldValueIndex.value++;
    if (oldValueIndex.value === oldValues.value.length) {
      value.value = "";
    } else {
      value.value = oldValues.value[oldValueIndex.value];
    }
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
        class: ["send", "lookup", "save", "savedmemes"].includes(text)
          ? "text-blue-500"
          : undefined,
      })),
    ]);
    oldValues.value.push(value.value);
    oldValueIndex.value = oldValues.value.length;
    if (value.value.startsWith("send ")) {
      const [_, type, ...json] = value.value.split(" ");
      let parsed;
      try {
        parsed = JSON.parse(json.join(" "));
      } catch {
        if (json.length !== 0) {
          err(`Bad JSON: '${JSON.stringify(json)}'`);
          value.value = "";
          return;
        }
        parsed = {};
      }
      handleSend(type, parsed);
    } else if (value.value.startsWith("lookup ")) {
      const [_, type, ...json] = value.value.split(" ");
      try {
        let parsed: any;
        parsed = json.length > 0 ? JSON.parse(json.join(" ")) : undefined;
        handleLookup(type, parsed);
      } catch {
        err("Wrong JSON");
      }
    } else if (value.value.startsWith("save ")) {
      const text = value.value.slice(5);
      try {
        const parsed = JSON.parse(text) as Highlight;
        const filter = (k: string) =>
          !["visual", "top", "bottom", "player"].includes(k);
        if (!parsed.visual || Object.keys(parsed).some(filter)) {
          const bad = Object.keys(parsed).filter(filter);
          if (bad.length > 0) err(`Bad keys: '${bad}'`);
          else err("Missing visual");
        } else {
          store.savedMemes.push(parsed);
          lines.value.push([c.green("Meme saved.")]);
        }
      } catch {
        err(`Bad JSON: ${JSON.stringify(text)}`);
      }
    } else if (value.value.toLowerCase() === "savedmemes") {
      lines.value.push([
        c.green("Saved Memes"),
        { text: ">" },
        ...store.savedMemes.map((m) => c.yellow(JSON.stringify(m))),
      ]);
    }
    pushToEnd();
    value.value = undefined;
  }
};

pushToEnd();
</script>

<template>
  <div
    v-if="isDebug"
    class="px-2 pt-2 fixed inset-x-0 top-0 transition-transform -translate-y-full z-[100] backdrop-blur backdrop-brightness-50"
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
        @keydown="onArrows"
      />
    </div>
  </div>
</template>

<style scoped>
input {
  @apply inline bg-transparent grow focus-visible:outline-none;
}
</style>
