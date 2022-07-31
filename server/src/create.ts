import lodash, { pick } from "lodash";
import log from "./log";
const { shuffle, unzip } = lodash;
import type { GameSettings, GameState, Hidden } from "./model";
import { InternalGameState } from "./state";

export function createSettings(): GameSettings {
  return {};
}

export function createInternalGameState(players: string[]): InternalGameState {
  return { currentTzar: 0, plays: players.map(() => null), tzarsTurn: false };
}

export function convertGameState(state: InternalGameState): GameState {
  const plays = state.plays.map((play) =>
    state.tzarsTurn ? play : play ? ("HIDDEN" as Hidden) : null
  );
  return {
    plays,
    currentTzar: state.currentTzar,
    tzarsTurn: state.tzarsTurn,
  };
}
