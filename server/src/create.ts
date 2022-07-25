import lodash from "lodash";
import log from "./log";
const { shuffle, unzip } = lodash;
import { GameSettings, GameState, Tuple } from "./model";

export function createSettings(): GameSettings {
  return {};
}

export function createGameState(players: string[]): GameState {
  return { currentTzar: 0 };
}
