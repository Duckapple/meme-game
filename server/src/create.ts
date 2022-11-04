import lodash from "lodash";
const { pick, shuffle } = lodash;
import {
  GameSettings,
  GameState,
  GameStyle,
  Hidden,
  MessageType,
  Move,
  UpdateRoomResponse,
  Visual,
} from "./model";
import { InternalGameState, Player } from "./state";
import { refresh, toptexts, bottomtexts, visuals } from "./api";
import _ from "lodash";
import log from "./log";
import { sendOnSocket } from "./utils";

export function createSettings(): GameSettings {
  return {
    handSize: 7,
    discardsPerRound: 0,
    canOmit: {
      bottom: false,
      top: false,
    },
    gameStyle: GameStyle.VOTE,
    winCondition: {
      n: 3,
      type: "points",
    },
    maxTimer: {
      move: 45000,
      pick: 60000,
    },
  };
}

export async function createInternalGameState(
  players: string[],
  settings: GameSettings
): Promise<InternalGameState> {
  await refresh();
  const piles: InternalGameState["piles"] = {
    top: shuffle(toptexts),
    bottom: shuffle(bottomtexts),
    visuals: shuffle(visuals),
  };

  let currentTzar: number;
  switch (settings.gameStyle) {
    case GameStyle.TZAR:
      currentTzar = 0;
      break;
    case GameStyle.VOTE:
    default:
      currentTzar = -1;
      break;
  }

  return {
    currentTzar,
    plays: players.map(() => null),
    shuffle: players.map((_, i) => i + 1),
    tzarsTurn: false,
    hands: players.map(() => ({
      top: piles.top.splice(0, settings.handSize),
      bottom: piles.bottom.splice(0, settings.handSize),
    })),
    visual: piles.visuals.splice(0, 1)[0].filename,
    piles,
    points: players.map(() => 0),
    timerEnd: Math.round(
      (new Date().getTime() + settings.maxTimer.move) / 1000 + 1
    ),
  };
}

export function convertGameState(state: InternalGameState): GameState {
  const plays = state.plays.map((play) =>
    play
      ? state.tzarsTurn
        ? { ...play, player: "" }
        : ("HIDDEN" as Hidden)
      : null
  );
  return {
    plays,
    ...pick(state, [
      "currentTzar",
      "tzarsTurn",
      "visual",
      "points",
      "timerEnd",
    ]),
  };
}

export function stopTimeout(state: InternalGameState): void {
  if (state.timeout) {
    clearTimeout(state.timeout);
    state.timeout = undefined;
  }
}

export function setNextTurn(
  state: InternalGameState,
  settings: GameSettings
): void {
  state.tzarsTurn = false;
  state.plays = state.plays.map(() => null);
  state.shuffle = state.plays.map((_, i) => i + 1);
  const visual = state.piles.visuals.splice(0, 1)[0].filename;
  state.visual = visual;
  state.hands = state.hands.map(({ top, bottom }) => ({
    bottom: [
      ...bottom,
      ...state.piles.bottom.splice(0, settings.handSize - bottom.length),
    ],
    top: [...top, ...state.piles.top.splice(0, settings.handSize - top.length)],
  }));
  if (state.currentTzar !== -1)
    state.currentTzar = (state.currentTzar + 1) % state.plays.length;
  state.timerEnd = Math.round(
    (new Date().getTime() + settings.maxTimer.move) / 1000 + 1
  );
}

export function setTzar(
  state: InternalGameState,
  settings: GameSettings,
  players: Player[]
): void {
  state.tzarsTurn = true;
  const shuffle = _.shuffle<[Move | null, number]>(
    state.plays.map((play, i) => [play, i + 1])
  );
  state.plays = shuffle.map(([play]) => play);
  state.shuffle = shuffle.map(([, num]) => num);
  state.timerEnd = Math.round(
    (new Date().getTime() + settings.maxTimer.pick) / 1000 + 1
  );
  log(`Shuffle is ${JSON.stringify(state.shuffle)}`);
  stopTimeout(state);
  state.timeout = setTimeout(() => {
    setNextTurn(state, settings);
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      update: "Time is up! Moving on to making moves.",
      state: convertGameState(state),
      moveState: null,
    };
    players.forEach(({ socket }, i) =>
      sendOnSocket(socket, {
        ...update,
        cardUpdate: { type: "replace", ...state.hands[i] },
      })
    );
  }, settings.maxTimer.pick + 1000);
}
