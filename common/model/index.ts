export * from "./communication";

export type Hidden = "HIDDEN";

export type Card = { id: number };

export type FullCard = Card & { text: string };
export type Visual = { id: number; filename: string };

export type Move = {
  player: string;
  top: FullCard;
  bottom: FullCard;
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
}

export interface GameState {
  visual: string | null;
  currentTzar: number;
  tzarsTurn: boolean;
  plays: (Move | Hidden | null)[];
  yourPlay: Move | null;
}

export type Tuple<T, N extends number> = number extends N
  ? T[]
  : _TupleOf<T, N, []>;
type _TupleOf<T, N extends number, R extends unknown[]> = R["length"] extends N
  ? R
  : _TupleOf<T, N, [T, ...R]>;
