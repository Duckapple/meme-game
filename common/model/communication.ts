import {
  Card,
  CardUpdate,
  FullCard,
  GameSettings,
  GameState,
  Highlight,
  Move,
  MoveState,
  RoomDetails,
  Visual,
  Standing,
  EndStandings,
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
  | VoteMessage
  | DoneVotingMessage
  | ForceSkipMessage
  | AdminMergeStateMessage;

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
  DONE_VOTING = "DONE_VOTING",
  ADMIN_MERGE_STATE = "ADMIN_MERGE_STATE",
  FORCE_SKIP = "FORCE_SKIP",
}

type UUID = string;
export type WithRoom = { roomID: string };
export type WithUser = { userID: UUID };
export type WithAdminOverride = { adminKey: string };
export type AssignUUIDMessage = {
  type: MessageType.ASSIGN_UUID;
  userID?: UUID | null;
  roomID?: string | null;
};
export type CreateRoomMessage = WithUser & {
  type: MessageType.CREATE_ROOM;
  username: string;
  roomID?: string;
};
export type JoinRoomMessage = WithUser &
  WithRoom & {
    type: MessageType.JOIN_ROOM;
    username: string;
  };
export type UpdateSettingsMessage = WithUser &
  WithRoom & {
    type: MessageType.UPDATE_SETTINGS;
    settings: GameSettings;
  };
export type RearrangePlayersMessage = WithUser &
  WithRoom & {
    type: MessageType.REARRANGE_PLAYERS;
    players: string[];
  };
export type BeginMessage = WithUser &
  WithRoom & {
    type: MessageType.BEGIN;
  };
export type MakeMoveMessage = WithUser &
  WithRoom & {
    type: MessageType.MAKE_MOVE;
    move: Partial<Omit<Move, "player">>;
  };
export type PickWinnerMessage = WithUser &
  WithRoom & {
    type: MessageType.PICK_WINNER;
  };
export type EndStandingsMessage = WithUser &
  WithRoom & {
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
export type VoteMessage = WithUser &
  WithRoom & {
    type: MessageType.VOTE;
    playIndex: number;
    voteState: boolean;
  };
export type DoneVotingMessage = WithUser &
  WithRoom & {
    type: MessageType.DONE_VOTING;
  };
export type ForceSkipMessage = WithUser &
  WithRoom & {
    type: MessageType.FORCE_SKIP;
    phase: GameState["phase"];
  };
export type AdminMergeStateMessage = WithRoom &
  WithAdminOverride & {
    type: MessageType.ADMIN_MERGE_STATE;
    state: any;
    update?: string;
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
  standings: EndStandings;
  // highlights: Highlight[];
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
