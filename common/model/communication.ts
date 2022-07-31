import { Card, FullCard, GameSettings, GameState, Move, RoomDetails } from ".";
export type Message =
  | CreateRoomMessage
  | JoinRoomMessage
  | RearrangePlayersMessage
  | BeginMessage
  | MakeMoveMessage
  | PickWinnerMessage
  | UpdateSettingsMessage
  | EndStandingsMessage;

export enum MessageType {
  CREATE_ROOM = "CREATE_ROOM",
  JOIN_ROOM = "JOIN_ROOM",
  REARRANGE_PLAYERS = "REARRANGE_PLAYERS",
  UPDATE_ROOM = "UPDATE_ROOM",
  UPDATE_SETTINGS = "UPDATE_SETTINGS",
  BEGIN = "BEGIN",
  ERROR = "ERROR",
  ASSIGN_UUID = "ASSIGN_UUID",
  MAKE_MOVE = "MAKE_MOVE",
  PICK_WINNER = "PICK_WINNER",
  END_GAME = "END_GAME",
  END_STANDINGS = "END_STANDINGS",
}

type UUID = string;
export type CreateRoomMessage = {
  type: MessageType.CREATE_ROOM;
  userID: UUID;
  username: string;
  roomID?: string;
};
export type JoinRoomMessage = {
  type: MessageType.JOIN_ROOM;
  userID: UUID;
  username: string;
  roomID: string;
};
export type UpdateSettingsMessage = {
  type: MessageType.UPDATE_SETTINGS;
  userID: UUID;
  roomID: string;
  settings: GameSettings;
};
export type RearrangePlayersMessage = {
  type: MessageType.REARRANGE_PLAYERS;
  userID: UUID;
  roomID: string;
  players: string[];
};
export type BeginMessage = {
  type: MessageType.BEGIN;
  roomID: string;
  userID: UUID;
};
export type MakeMoveMessage = {
  type: MessageType.MAKE_MOVE;
  roomID: string;
  userID: UUID;
  move: Omit<Move, "player">;
};
export type PickWinnerMessage = {
  type: MessageType.PICK_WINNER;
  roomID: string;
  userID: UUID;
};
export type EndStandingsMessage = {
  type: MessageType.END_STANDINGS;
  roomID: string;
  userID: UUID;
};

export type MessageResponse =
  | CreateRoomResponse
  | JoinRoomResponse
  | UpdateRoomResponse
  | AssignUUIDResponse
  | EndGameResponse
  | EndStandingsResponse
  | ErrorResponse;

export type CreateRoomResponse = RoomDetails & {
  type: MessageType.CREATE_ROOM;
};
export type JoinRoomResponse = RoomDetails & {
  type: MessageType.JOIN_ROOM;
};
export type UpdateRoomResponse = Partial<Omit<RoomDetails, "roomID">> & {
  type: MessageType.UPDATE_ROOM;
  update: string;
  newCards?: Record<"top" | "bottom", FullCard[]>;
};
export type AssignUUIDResponse = {
  type: MessageType.ASSIGN_UUID;
  userID: UUID;
  visual_cdn: string;
};
export type EndGameResponse = {
  type: MessageType.END_GAME;
  state: GameState;
  standings: string[];
};
export type EndStandingsResponse = {
  type: MessageType.END_STANDINGS;
};
export type ErrorResponse = {
  type: MessageType.ERROR;
  error: string;
};
