import { reactive, ref, watch } from "vue";
import type { Highlight, RoomDetails } from "./model";

const localStoreKey = "meme-game-store";

type Store = {
  settings: {
    colorBlind: boolean;
    debug?: boolean;
  };
  savedMemes: Highlight[];
};

let initialStore: Store = { settings: { colorBlind: false }, savedMemes: [] };
const localStore = localStorage.getItem(localStoreKey);

if (localStore) {
  initialStore = { ...initialStore, ...JSON.parse(localStore) };
}

export const store = reactive<Store>(initialStore);

watch(store, (val) => {
  const stringified = JSON.stringify(val);
  localStorage.setItem(localStoreKey, stringified);
});

export const username = ref<string>(
  localStorage.getItem("meme_game_username") ?? ""
);
watch(username, (username) => {
  localStorage.setItem("meme_game_username", username);
});

// TODO: Fix the fact that sessions are window-specific and not tab-specific...
export const UUID = ref<string>(sessionStorage.getItem("meme_game_UUID") ?? "");
watch(UUID, (UUID) => {
  sessionStorage.setItem("meme_game_UUID", UUID);
});

export const visual_cdn = ref<string>();

export const roomDetails = ref<RoomDetails>();
