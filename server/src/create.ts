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

export function createSettings(): GameSettings {
  return {
    handSize: 7,
    discardsPerRound: 0,
    canOmit: {
      bottom: false,
      top: false,
    },
    gameStyle: GameStyle.VOTE,
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
    tzarsTurn: false,
    hands: players.map(() => ({
      top: piles.top.splice(0, settings.handSize),
      bottom: piles.bottom.splice(0, settings.handSize),
    })),
    visual: piles.visuals.splice(0, 1)[0].filename,
    piles,
  };
}

function convertHand(move: Move) {}

export function convertGameState(state: InternalGameState): GameState {
  const plays = state.plays.map((play) =>
    state.tzarsTurn ? play : play ? ("HIDDEN" as Hidden) : null
  );
  return {
    plays,
    ...pick(state, ["currentTzar", "tzarsTurn", "visual"]),
  };
}
