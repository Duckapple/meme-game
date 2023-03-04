import { WebSocket } from "ws";
import { randomInt, randomUUID } from "crypto";
import {
  FullCard,
  GameSettings,
  GameState,
  Hidden,
  Move,
  Visual,
} from "./model";
import log from "./log";

export type Player = {
  socket: WebSocket;
  name: string;
  UUID: string;
};

export interface InternalGameState extends GameState {
  plays: (Move | null)[]; // 'Hidden' is just a Move in the !tzarsTurn phase
  shuffle: number[];
  hands: Record<"top" | "bottom", FullCard[]>[];
  /** For each play, have a set of voter UUIDs for that play */
  votes: Set<string>[];
  timeout?: NodeJS.Timeout;
  piles: {
    top: FullCard[];
    bottom: FullCard[];
    visuals: Visual[];
  };
}

export type Room = {
  players: Player[];
  creator: Player;
  broadcasters: Player[];
  createdAt: Date;
  updatedAt: Date;
  state?: InternalGameState;
  settings: GameSettings;
};

// type Rooms = Record<string, Room>;

const UUIDs = new Set<string>();

export const rooms: Map<string, Room> = new Map();

const radix = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function createRoomID(): string {
  let id = "";
  for (let i = 0; i < 4; i++) {
    id += radix[randomInt(0, radix.length)];
  }
  return id;
}

/**
 * Check if player is in room with given ID, returning the {@link Player} data if in progress, `false` otherwise.
 */
export function isGameInProgress(
  userID: string,
  roomID?: string | null
): false | number {
  if (!roomID) return false;
  const room = rooms.get(roomID);
  if (!room) return false;
  const playerID = room.players.findIndex(({ UUID }) => UUID === userID);
  if (playerID === -1) return false;
  return playerID;
}

export function createUUID(): string {
  let uuid: string;
  do uuid = randomUUID();
  while (UUIDs.has(uuid));
  UUIDs.add(uuid);
  return uuid;
}
