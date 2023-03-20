export * from "./communication";

export type Hidden = "HIDDEN";

export type Card = { id: number };
export type Blank = { id: -1; text?: string };

export type FullCard = Card & { text: string };
export type Visual = { id: number; filename: string };

export type AnonymousMove = {
  top?: FullCard | Blank;
  bottom?: FullCard | Blank;
};

export type Move = AnonymousMove & {
  player: string;
};

export type RoomDetails = {
  roomID: string;
  state?: GameState;
  players: string[];
  creator: string;
  settings: GameSettings;
};

export interface GameSettings {
  handSize: number;
  discardsPerRound: number;
  canOmit: Record<"top" | "bottom", boolean>;
  gameStyle: GameStyle;
  winCondition: {
    n: number;
    type: "rounds" | "points";
  };
  pointCount: "votes" | "best";
  maxTimer: Record<GameState["phase"], number>;
  imageMode: "scale" | "stretch";
  blanks: number;
}

export interface GameState {
  visual: string | null;
  currentTzar: number;
  phase: "move" | "vote" | "standings";
  plays: (Move | Hidden | null)[];
  points: number[];
  /** Ordered list of tuples of the move, player index, and the number of points */
  standings?: [Move | null, number, number][];
  doneVoting?: boolean[];
  hasAnyoneWon?: boolean;
  timerEnd: number;
  rounds: number;
}

export interface CardUpdate {
  top: (FullCard | Blank)[];
  bottom: (FullCard | Blank)[];
  type: "add" | "replace";
}

export interface MoveState {
  top?: Card["id"];
  bottom?: Card["id"];
}

export enum GameStyle {
  VOTE = "VOTE",
  TZAR = "TZAR",
}

export type Tuple<T, N extends number> = number extends N
  ? T[]
  : _TupleOf<T, N, []>;
type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;

type PlayerName = string;
export type Standing = `${number}st` | `${number}nd` | `${number}rd`;
export type EndStandings = Record<
  Standing,
  { players: PlayerName[]; standing: number }
>;

export type Highlight = (Move | AnonymousMove) & {
  visual: string;
};
