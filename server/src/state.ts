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
  hands: Record<"top" | "bottom", FullCard[]>[];
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

export function createRoomID(): string {
  return randomInt(100000, 999999).toString();
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
