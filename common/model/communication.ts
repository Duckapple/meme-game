import {
  Card,
  CardUpdate,
  FullCard,
  GameSettings,
  GameState,
  Move,
  MoveState,
  RoomDetails,
  Visual,
} from ".";
export type Message =
  | AssignUUIDMessage
  | CreateRoomMessage
  | JoinRoomMessage
  | RearrangePlayersMessage
  | BeginMessage
  | MakeMoveMessage
  | PickWinnerMessage
  | UpdateSettingsMessage
  | EndStandingsMessage
  | LookupMessage
  | VoteMessage;

export enum MessageType {
  CREATE_ROOM = "CREATE_ROOM",
  JOIN_ROOM = "JOIN_ROOM",
  REJOIN_ROOM = "REJOIN_ROOM",
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
  LOOKUP = "LOOKUP",
  VOTE = "VOTE",
}

type UUID = string;
export type UserAndRoom = { userID: UUID; roomID: string };
export type AssignUUIDMessage = {
  type: MessageType.ASSIGN_UUID;
  userID?: UUID | null;
  roomID?: string | null;
};
export type CreateRoomMessage = {
  type: MessageType.CREATE_ROOM;
  userID: UUID;
  username: string;
  roomID?: string;
};
export type JoinRoomMessage = UserAndRoom & {
  type: MessageType.JOIN_ROOM;
  username: string;
};
export type UpdateSettingsMessage = UserAndRoom & {
  type: MessageType.UPDATE_SETTINGS;
  settings: GameSettings;
};
export type RearrangePlayersMessage = UserAndRoom & {
  type: MessageType.REARRANGE_PLAYERS;
  players: string[];
};
export type BeginMessage = UserAndRoom & {
  type: MessageType.BEGIN;
};
export type MakeMoveMessage = UserAndRoom & {
  type: MessageType.MAKE_MOVE;
  move: Partial<Omit<Move, "player">>;
};
export type PickWinnerMessage = UserAndRoom & {
  type: MessageType.PICK_WINNER;
};
export type EndStandingsMessage = UserAndRoom & {
  type: MessageType.END_STANDINGS;
};
export type LookupMessage = {
  type: MessageType.LOOKUP;
} & (
  | {
      elementType: "top" | "bottom";
      data: Partial<FullCard>;
    }
  | {
      elementType: "visual";
      data: Partial<Visual>;
    }
);
export type VoteMessage = UserAndRoom & {
  type: MessageType.VOTE;
  playIndex: number;
  voteState: boolean;
};

export type MessageResponse =
  | CreateRoomResponse
  | JoinRoomResponse
  | ReJoinRoomResponse
  | UpdateRoomResponse
  | AssignUUIDResponse
  | EndGameResponse
  | EndStandingsResponse
  | LookupResponse
  | ErrorResponse;

export type CreateRoomResponse = RoomDetails & {
  type: MessageType.CREATE_ROOM;
};
export type JoinRoomResponse = RoomDetails & {
  type: MessageType.JOIN_ROOM;
};
export type ReJoinRoomResponse = RoomDetails & {
  type: MessageType.REJOIN_ROOM;
  cardUpdate?: CardUpdate;
};
export type UpdateRoomResponse = Partial<Omit<RoomDetails, "roomID">> & {
  type: MessageType.UPDATE_ROOM;
  update: string;
  cardUpdate?: CardUpdate;
  moveState?: MoveState | null;
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
export type LookupResponse = {
  type: MessageType.LOOKUP;
} & (
  | { elementType: "top" | "bottom"; data?: FullCard }
  | { elementType: "visual"; data?: Visual }
);
export type ErrorResponse = {
  type: MessageType.ERROR;
  error: string;
  data?: unknown;
};
