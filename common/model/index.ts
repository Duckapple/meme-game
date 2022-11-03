export * from "./communication";

export type Hidden = "HIDDEN";

export type Card = { id: number };

export type FullCard = Card & { text: string };
export type Visual = { id: number; filename: string };

export type AnonymousMove = {
  top?: FullCard;
  bottom?: FullCard;
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
  maxTimer: Record<"move" | "pick", number>;
}

export interface GameState {
  visual: string | null;
  currentTzar: number;
  tzarsTurn: boolean;
  plays: (Move | Hidden | null)[];
  points: number[];
  timerEnd: number;
}

export interface CardUpdate {
  top: FullCard[];
  bottom: FullCard[];
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
