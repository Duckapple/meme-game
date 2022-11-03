import lodash from "lodash";
const { pick, shuffle } = lodash;
import {
  GameSettings,
  GameState,
  GameStyle,
  Hidden,
  Move,
  Visual,
} from "./model";
import { InternalGameState } from "./state";
import { refresh, toptexts, bottomtexts, visuals } from "./api";
import _ from "lodash";
import log from "./log";

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

export function setTzar(state: InternalGameState): void {
  state.tzarsTurn = true;
  const shuffle = _.shuffle<[Move | null, number]>(
    state.plays.map((play, i) => [play, i + 1])
  );
  state.plays = shuffle.map(([play]) => play);
  state.shuffle = shuffle.map(([, num]) => num);
  log(`Shuffle is ${JSON.stringify(state.shuffle)}`);
}
