<script setup lang="ts">
import { omit } from "lodash";
import { ref } from "vue";
import {
  MessageType,
  CreateRoomMessage,
  MessageResponse,
  RoomDetails,
  JoinRoomMessage,
  RearrangePlayersMessage,
  BeginMessage,
  MakeMoveMessage,
  UpdateSettingsMessage,
  EndStandingsMessage,
  FullCard,
  AssignUUIDMessage,
  Move,
  MoveState,
  CardUpdate,
  VoteMessage,
  EndStandings,
  DoneVotingMessage,
  Blank,
  ForceSkipMessage,
} from "./model";
import RoomPrompt from "./components/RoomPrompt.vue";
import Room from "./components/Room.vue";
import Game from "./components/Game.vue";
import GameEnd from "./components/GameEnd.vue";
import { stopConfetti } from "./confetti";
import Debug from "./components/Debug.vue";

import { subscriptions, ws } from "./comms";
import { username, UUID, visual_cdn, roomDetails, store } from "./state";
import ResponsiveIndicator from "./components/ResponsiveIndicator.vue";
import SavedMemes from "./components/SavedMemes.vue";

export type MakeMoveFunction = (args: Partial<Move>) => void;

const hand = ref<undefined | Record<"top" | "bottom", (FullCard | Blank)[]>>({
  top: [],
  bottom: [],
});
const moveState = ref<MoveState | null>();
const standings = ref<EndStandings>();
const showDebug = ref(false);
const showSavedMemes = ref(false);
const toggleDebug = () => (showDebug.value = !showDebug.value);

const ERROR = "ERROR";

const notifs = ref<{ message: string; error: boolean }[]>([]);

const addNotif = (message: string, isError?: typeof ERROR) => {
  notifs.value.push({ message, error: !!isError });
  setTimeout(() => {
    notifs.value.shift();
  }, 4000);
};

function handleCardUpdate(cardUpdate?: CardUpdate) {
  if (cardUpdate) {
    if (!hand.value || cardUpdate.type === "replace")
      hand.value = omit(cardUpdate, "type");
    else {
      hand.value.bottom.push(...cardUpdate.bottom);
      hand.value.top.push(...cardUpdate.top);
    }
  }
}

function handleErrorData(data: unknown) {}

function onMessage(evt: MessageEvent | Event) {
  let m: MessageResponse;
  if (!("data" in evt)) return;
  try {
    m = JSON.parse(evt.data.toString());
  } catch (err) {
    addNotif(`Could not parse message '${evt.data}'`);
    return;
  }

  if (m.type === MessageType.ASSIGN_UUID) {
    if (!UUID.value) UUID.value = m.userID;
    visual_cdn.value = m.visual_cdn;
  } else if (m.type === MessageType.CREATE_ROOM) {
    location.hash = `#${m.roomID}`;
    roomDetails.value = omit(m, "type");
  } else if (m.type === MessageType.JOIN_ROOM) {
    location.hash = `#${m.roomID}`;
    roomDetails.value = omit(m, "type");
  } else if (m.type === MessageType.REJOIN_ROOM) {
    location.hash = `#${m.roomID}`;
    roomDetails.value = omit(m, "type");
    handleCardUpdate(m.cardUpdate);
  } else if (m.type === MessageType.UPDATE_ROOM) {
    if (!roomDetails.value) {
      addNotif("Got update for non-existing room details!");
    } else {
      roomDetails.value = {
        ...roomDetails.value,
        ...omit(m, ["type", "newCards"]),
        state: m.state
          ? {
              ...roomDetails.value.state,
              ...m.state,
            }
          : roomDetails.value.state,
      };
    }
    handleCardUpdate(m.cardUpdate);
    if (m.moveState !== undefined) {
      moveState.value = m.moveState;
    }
    if (m.update) addNotif(m.update);
  } else if (m.type === MessageType.ERROR) {
    if (m.error) addNotif(m.error, ERROR);
    if (m.data) handleErrorData(m.data);
  } else if (m.type === MessageType.END_GAME) {
    roomDetails.value && (roomDetails.value.state = m.state);
    standings.value = m.standings;
  } else if (m.type === MessageType.END_STANDINGS) {
    stopConfetti();
    standings.value = undefined;
    roomDetails.value && (roomDetails.value.state = undefined);
    roomDetails.value = undefined;
    hand.value = undefined;
    location.hash = "";
  } else if (m.type === MessageType.LOOKUP) {
    // Do nothing :)
  } else {
    addNotif(`Got unhandled message '${evt.data}'`);
  }
}

subscriptions.push(["message", onMessage]);

subscriptions.push([
  "open",
  () => {
    addNotif("Connected to server");
    let roomID: string | undefined = undefined;
    const roomFromHash = location.hash.match("#(\\d{6})")?.[1];
    if (roomFromHash) {
      roomID = roomFromHash;
    }
    const msg: AssignUUIDMessage = {
      type: MessageType.ASSIGN_UUID,
      userID: UUID.value,
      roomID,
    };
    ws.value.send(JSON.stringify(msg));
  },
]);
subscriptions.push([
  "close",
  () => {
    addNotif("Disconnected from server...");
  },
]);

const onJoin = (userName: string, roomID: string) => {
  if (!UUID.value) return;
  username.value = userName;
  const msg: JoinRoomMessage = {
    type: MessageType.JOIN_ROOM,
    username: userName,
    userID: UUID.value,
    roomID,
  };
  ws.value.send(JSON.stringify(msg));
};
const onCreate = (userName: string) => {
  if (!UUID.value) return;
  username.value = userName;
  const msg: CreateRoomMessage = {
    type: MessageType.CREATE_ROOM,
    username: userName,
    userID: UUID.value,
  };
  ws.value.send(JSON.stringify(msg));
};
const onSettingsUpdate = () => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: UpdateSettingsMessage = {
    type: MessageType.UPDATE_SETTINGS,
    userID: UUID.value,
    roomID: roomDetails.value.roomID,
    settings: roomDetails.value.settings,
  };
  ws.value.send(JSON.stringify(msg));
};
const onReorder = (players: string[]) => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: RearrangePlayersMessage = {
    type: MessageType.REARRANGE_PLAYERS,
    roomID: roomDetails.value.roomID,
    players,
    userID: UUID.value,
  };
  ws.value.send(JSON.stringify(msg));
};
const onBegin = () => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: BeginMessage = {
    type: MessageType.BEGIN,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
  };
  ws.value.send(JSON.stringify(msg));
};

const onMakeMove: MakeMoveFunction = (move) => {
  if (!roomDetails.value || !UUID.value) return;
  if (!roomDetails.value.settings.canOmit.top && !move.top)
    return addNotif("Cannot omit top text", "ERROR");
  if (!roomDetails.value.settings.canOmit.bottom && !move.bottom)
    return addNotif("Cannot omit bottom text", "ERROR");
  const msg: MakeMoveMessage = {
    type: MessageType.MAKE_MOVE,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
    move,
  };
  ws.value.send(JSON.stringify(msg));
};

const onMakeLike = (playIndex: number, voteState: boolean) => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: VoteMessage = {
    type: MessageType.VOTE,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
    playIndex,
    voteState,
  };
  ws.value.send(JSON.stringify(msg));
};

const onDoneVoting = () => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: DoneVotingMessage = {
    type: MessageType.DONE_VOTING,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
  };
  ws.value.send(JSON.stringify(msg));
};

const onNextTurn = () => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: ForceSkipMessage = {
    type: MessageType.FORCE_SKIP,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
    phase: "standings",
  };
  ws.value.send(JSON.stringify(msg));
};

const onEndStandings = () => {
  if (!roomDetails.value || !UUID.value) return;
  const msg: EndStandingsMessage = {
    type: MessageType.END_STANDINGS,
    roomID: roomDetails.value.roomID,
    userID: UUID.value,
  };
  ws.value.send(JSON.stringify(msg));
};
</script>

<template>
  <RoomPrompt
    v-if="!roomDetails && !showSavedMemes"
    :on-join="onJoin"
    :on-create="onCreate"
    :on-saved-memes="() => (showSavedMemes = !showSavedMemes)"
  />
  <Room
    v-if="username && roomDetails && !roomDetails.state"
    v-bind="roomDetails"
    :onReorder="onReorder"
    :username="username"
    :onBegin="onBegin"
    :onSettingsUpdate="onSettingsUpdate"
  />
  <Game
    v-if="username && roomDetails?.state && hand"
    v-bind="{
      players: roomDetails.players,
      creator: roomDetails.creator,
      state: roomDetails.state,
      settings: roomDetails.settings,
      hand,
      username,
      onMakeMove,
      onMakeLike,
      onDoneVoting,
      onNextTurn,
      moveState,
    }"
  />
  <div class="fixed bottom-4 right-4">
    <div
      v-for="{ message, error } in notifs"
      class="w-64 p-4 mb-2 bg-white md:border-2 md:border-red-500 sm:w-sm md:w-md dark:bg-gray-900"
      :class="{ 'md:border-red-500': error, 'md:border-gray-500': !error }"
    >
      {{ message }}
    </div>
  </div>
  <GameEnd
    v-if="standings"
    :standings="standings"
    :username="username"
    :endGame="username === roomDetails?.creator ? onEndStandings : undefined"
  />
  <Debug :show-debug="showDebug" :toggle-debug="toggleDebug" />
  <ResponsiveIndicator v-if="showDebug" />
  <SavedMemes
    v-if="showSavedMemes"
    :go-back="() => (showSavedMemes = !showSavedMemes)"
  />
</template>

<style>
body {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  @apply flex flex-col text-gray-900 bg-white dark:bg-gray-900 dark:text-gray-200 border-gray-800 dark:border-gray-200;
}

.btn {
  @apply border-2 cursor-pointer hover:underline transition hover:-translate-y-2 hover:shadow bg-white dark:bg-gray-900 border-gray-800 dark:border-gray-200;
}

.disabled {
  @apply text-gray-500 dark:text-gray-400 cursor-not-allowed;
}

.btn.disabled {
  @apply hover:translate-y-0 hover:shadow-none hover:no-underline cursor-not-allowed;
}

.text-shadow {
  text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000,
    1px 1px 0 #000;
}
</style>
