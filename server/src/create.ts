import lodash from "lodash";
const { pick, shuffle } = lodash;
import {
  Blank,
  EndGameResponse,
  FullCard,
  GameSettings,
  GameState,
  GameStyle,
  Hidden,
  MessageType,
  Move,
  Standing,
  UpdateRoomResponse,
  Visual,
} from "./model";
import { InternalGameState, Player } from "./state";
import { refresh, toptexts, bottomtexts, visuals } from "./api";
import _ from "lodash";
import log from "./log";
import { sendOnSocket } from "./utils";
import { randomInt } from "crypto";

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
      vote: 60000,
      standings: 15000,
    },
    pointCount: "votes",
    imageMode: "stretch",
    blanks: 5,
  };
}

function maybeTakeBlanks(amount: number, percentage: number, pile: FullCard[]) {
  let blanks = 0;
  let actual = 0;
  for (let i = 0; i < amount; i++) {
    if (randomInt(0, 100) < percentage) blanks++;
    else actual++;
  }
  return [...Array(blanks).fill({ id: -1 }), ...pile.splice(0, actual)];
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
    shuffle: players.map((_, i) => i),
    votes: players.map(() => new Set()),
    phase: "move",
    hands: players.map(() => ({
      top: maybeTakeBlanks(settings.handSize, settings.blanks, piles.top),
      bottom: maybeTakeBlanks(settings.handSize, settings.blanks, piles.bottom),
    })),
    visual: piles.visuals.splice(0, 1)[0].filename,
    piles,
    points: players.map(() => 0),
    timerEnd: Math.round(
      (new Date().getTime() + settings.maxTimer.move) / 1000 + 1
    ),
    rounds: 0,
  };
}

export function convertGameState(
  state: InternalGameState,
  pName?: string
): GameState {
  const plays = state.plays.map((play) =>
    play
      ? state.phase === "vote"
        ? { ...play, player: pName === play.player ? pName : "" }
        : "HIDDEN"
      : null
  );
  return {
    plays,
    ...pick(state, [
      "currentTzar",
      "phase",
      "visual",
      "points",
      "timerEnd",
      "standings",
      "rounds",
      "hasAnyoneWon",
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
  settings: GameSettings,
  players: Player[]
): void {
  state.rounds += 1;
  state.phase = "move";
  const visual = state.piles.visuals.splice(0, 1)[0].filename;
  state.visual = visual;
  state.hands = state.hands.map(({ top, bottom }) => ({
    bottom: [
      ...bottom,
      ...maybeTakeBlanks(
        settings.handSize - bottom.length,
        settings.blanks,
        state.piles.bottom
      ),
    ],
    top: [
      ...top,
      ...maybeTakeBlanks(
        settings.handSize - top.length,
        settings.blanks,
        state.piles.top
      ),
    ],
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
  state.phase = "vote";
  const shuffle = _.shuffle<[Move | null, number]>(
    state.plays.map((play, i) => [play, i])
  );
  state.plays = shuffle.map(([play]) => play);
  state.shuffle = shuffle.map(([, num]) => num);
  state.votes = players.map(() => new Set());
  state.doneVoting = players.map(() => false);
  state.timerEnd = Math.round(
    (new Date().getTime() + settings.maxTimer.vote) / 1000 + 1
  );
  log(`Shuffle is ${JSON.stringify(state.shuffle)}`);
  stopTimeout(state);
  state.timeout = setTimeout(() => {
    setStandings(state, settings, players);
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      update: "Time is up! Moving on to standings.",
      state: convertGameState(state),
      moveState: null,
    };
    players.forEach(({ socket }) => sendOnSocket(socket, update));
  }, settings.maxTimer.vote + 1000);
}

function err(_switchValue: never): never {
  throw new Error("Unhandled switch case: " + _switchValue);
}

function hasAnyoneWon(
  state: InternalGameState,
  settings: GameSettings
): boolean {
  switch (settings.winCondition.type) {
    case "points":
      return state.points.some((p) => p >= settings.winCondition.n);
    case "rounds":
      return state.rounds >= settings.winCondition.n;
    default:
      err(settings.winCondition.type);
  }
}

function standingize(n: number): Standing {
  if (n % 10 === 1) return `${n}st`;
  if (n % 10 === 2) return `${n}nd`;
  return `${n}rd`;
}

function getStanding(
  state: InternalGameState,
  settings: GameSettings,
  players: Player[]
): EndGameResponse["standings"] {
  switch (settings.winCondition.type) {
    case "points":
    case "rounds":
      const grouped = state.points.map((p, i) => [p, i]);
      grouped.sort(([p1], [p2]) => p2 - p1);
      let currentPoints = Infinity;
      let currentStand = 0;
      const res: EndGameResponse["standings"] = {};
      for (const [points, i] of grouped) {
        if (points < currentPoints) {
          currentStand++;
          currentPoints = points;
        }
        const st = standingize(currentStand);
        if (!res[st]) res[st] = { standing: currentStand, players: [] };
        res[st].players.push(players[i].name);
      }
      return res;
    default:
      err(settings.winCondition.type);
  }
}

export function setStandings(
  state: InternalGameState,
  settings: GameSettings,
  players: Player[]
): void {
  state.phase = "standings";
  players.forEach(({ UUID }, i) => {
    if (!state.votes.some((set) => set.has(UUID))) {
      state.shuffle.forEach((i2) => {
        if (i2 !== i) state.votes[i2].add(UUID);
      });
    }
  });
  const results = state.votes
    .map<[Move | null, number, number]>((set, i) => [
      state.plays[i],
      state.shuffle[i],
      set.size,
    ])
    .sort(([, , a], [, , b]) => b - a);
  state.standings = results;
  const winnerVotes = results[0][2];
  results
    .filter(([, , x]) => x === winnerVotes)
    .forEach(([, i]) => (state.points[i] += 1));
  state.plays = state.plays.map(() => null);
  state.shuffle = state.plays.map((_, i) => i);
  state.hasAnyoneWon = hasAnyoneWon(state, settings);

  state.timerEnd = Math.round(
    (new Date().getTime() + settings.maxTimer.standings) / 1000 + 1
  );
  stopTimeout(state);
  state.timeout = setTimeout(() => {
    if (state.hasAnyoneWon) {
      const standingsMsg: EndGameResponse = {
        type: MessageType.END_GAME,
        state: convertGameState(state),
        standings: getStanding(state, settings, players),
        // highlights: [],
      };
      players.forEach(({ socket }) => sendOnSocket(socket, standingsMsg));
      return;
    }
    setNextTurn(state, settings, players);
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      update: "Time is up! Moving on to next round.",
      state: convertGameState(state),
      moveState: null,
    };
    players.forEach(({ socket }, i) =>
      sendOnSocket(socket, {
        ...update,
        cardUpdate: { type: "replace", ...state.hands[i] },
      })
    );
  }, settings.maxTimer.standings + 1000);
}
