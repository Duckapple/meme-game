import lodash from "lodash";
const { shuffle } = lodash;
import type { GameSettings, GameState, Hidden } from "./model";
import { InternalGameState } from "./state";
import { refresh, toptexts, bottomtexts, visuals, Visual } from "./api";

export function createSettings(): GameSettings {
  return {
    handSize: 7,
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
  return {
    currentTzar: 0,
    plays: players.map(() => null),
    tzarsTurn: false,
    hands: players.map(() => ({
      top: piles.top.splice(0, settings.handSize),
      bottom: piles.bottom.splice(0, settings.handSize),
    })),
    visual: piles.visuals.splice(0, 1)[0].filename,
    piles,
  };
}

export function convertGameState(state: InternalGameState): GameState {
  const plays = state.plays.map((play) =>
    state.tzarsTurn ? play : play ? ("HIDDEN" as Hidden) : null
  );
  return {
    plays,
    currentTzar: state.currentTzar,
    tzarsTurn: state.tzarsTurn,
    visual: state.visual,
  };
}
