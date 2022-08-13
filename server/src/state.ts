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

export function createUUID(): string {
  let uuid: string;
  do uuid = randomUUID();
  while (UUIDs.has(uuid));
  UUIDs.add(uuid);
  return uuid;
}
