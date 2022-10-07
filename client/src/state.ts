import { reactive, ref, watch } from "vue";
import type { RoomDetails } from "./model";

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

export const username = ref<string>(
  localStorage.getItem("meme_game_username") ?? ""
);
watch(username, (username) => {
  localStorage.setItem("meme_game_username", username);
});

export const UUID = ref<string>(sessionStorage.getItem("meme_game_UUID") ?? "");
watch(UUID, (UUID) => {
  sessionStorage.setItem("meme_game_UUID", UUID);
});

export const visual_cdn = ref<string>();

export const roomDetails = ref<RoomDetails>();
