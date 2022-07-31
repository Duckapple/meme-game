import { reactive, ref, watch } from "vue";

const localStoreKey = "meme-game-store";

let initialStore = { settings: { colorBlind: false } };
const localStore = localStorage.getItem(localStoreKey);

if (localStore) {
  initialStore = JSON.parse(localStore);
}

export const store = reactive<{
  settings: {
    colorBlind: boolean;
    debug?: boolean;
  };
}>(initialStore);

watch(store, (val) => {
  const stringified = JSON.stringify(val);
  localStorage.setItem(localStoreKey, stringified);
});

export const username = ref<string>(localStorage.getItem("username") ?? "");
export const visual_cdn = ref<string>();
