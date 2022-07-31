import express from "express";
import expressWs from "express-ws";
import WS from "ws";
import {
  Message,
  MessageType,
  CreateRoomResponse,
  UpdateRoomResponse,
  JoinRoomResponse,
  ErrorResponse,
  CreateRoomMessage,
  JoinRoomMessage,
  RearrangePlayersMessage,
  BeginMessage,
  AssignUUIDResponse,
  MakeMoveMessage,
  UpdateSettingsMessage,
  EndStandingsMessage,
  EndStandingsResponse,
} from "./model";
import {
  convertGameState,
  createInternalGameState,
  createSettings,
} from "./create";
import { rooms, Player, createRoomID, createUUID, Room } from "./state";
import log from "./log";
import { exit } from "process";
const { app } = expressWs(express());
const port = process.env.PORT || 8080;
const visual_cdn = process.env.VISUAL_CDN;

if (!visual_cdn) {
  log("Env variable VISUAL_CDN not set! Exiting...");
  exit();
}

export function createError(error: string): string {
  const err: ErrorResponse = {
    type: MessageType.ERROR,
    error,
  };
  log(`Encountered error '${error}'`);
  return JSON.stringify(err);
}

function handleCreateRoom(ws: WS.WebSocket, m: CreateRoomMessage) {
  if (!m.userID || !m.username) return ws.send(createError("No user ID"));

  let roomID: string;
  if (m.roomID && !rooms.has(m.roomID)) roomID = m.roomID;
  else
    do roomID = createRoomID();
    while (rooms.has(roomID));

  const time = new Date();
  const player: Player = { name: m.username, socket: ws, UUID: m.userID };
  const players: Player[] = [player];
  const settings = createSettings();
  rooms.set(roomID, {
    creator: player,
    createdAt: time,
    updatedAt: time,
    players,
    broadcasters: [],
    settings,
  });
  const res: CreateRoomResponse = {
    type: MessageType.CREATE_ROOM,
    roomID,
    players: players.map(({ name }) => name),
    creator: m.username,
    settings,
  };
  ws.send(JSON.stringify(res));
  log(`Created room ${roomID}`);
}

function handleJoinRoom(ws: WS.WebSocket, m: JoinRoomMessage) {
  if (!m.userID || !m.username) return ws.send(createError("No user ID"));
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  const existing = room.players.find((player) => player.name === m.username);
  if (existing) {
    const closedStates: (0 | 1 | 2 | 3)[] = [WS.CLOSING, WS.CLOSED];
    // If connection was closed, allow hijacking
    if (closedStates.includes(existing.socket.readyState)) existing.socket = ws;
    else return ws.send(createError("User already in room"));
  } else if (room.players.length >= 4) {
    return ws.send(createError("Room full"));
  } else if (room.state) {
    return ws.send(createError("Game already in progress"));
  }

  const otherPlayers = room.players.map(({ socket }) => socket);

  // TODO: Enables hijacking, pls fix maybe
  if (!existing)
    room.players.push({ name: m.username, socket: ws, UUID: m.userID });

  const joinRes: JoinRoomResponse = {
    type: MessageType.JOIN_ROOM,
    creator: room.creator.name,
    players: room.players.map(({ name }) => name),
    roomID: m.roomID,
    state: room.state,
    settings: room.settings,
  };
  ws.send(JSON.stringify(joinRes));
  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    players: room.players.map(({ name }) => name),
    update: `User ${m.username} joined the room`,
  };
  otherPlayers.forEach((otherPlayer) =>
    otherPlayer.send(JSON.stringify(update))
  );
  log(`Joined room ${m.roomID}`);
}
function handleRearrangePlayers(ws: WS.WebSocket, m: RearrangePlayersMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  if (!m.userID || room.creator.UUID !== m.userID)
    return ws.send(createError("Invalid user ID"));

  let check = true;
  const playerCheck = room.players.map(({ name }) => name);
  m.players.forEach((player) => {
    const other = playerCheck.findIndex((other) => other === player);
    if (other === -1) check = false;
    playerCheck.splice(other, 1);
  });

  if (!check || playerCheck.length > 0)
    return ws.send(createError("Invalid player list"));

  let worked = true;
  const reordered = m.players.map((name) => {
    const player = room.players.find(({ name: n }) => name === n);
    if (!player) worked = false;
    return player as Player;
  });
  if (!worked) return ws.send(createError("Could not reorder players"));

  room.players = reordered;

  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    players: reordered.map(({ name }) => name),
    update: "Rearranged players",
  };
  reordered.forEach(({ socket }) => socket.send(JSON.stringify(update)));
  log(`Rearranged players in room ${m.roomID}`);
}

async function handleBegin(ws: WS.WebSocket, m: BeginMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  if (!m.userID || room.creator.UUID !== m.userID)
    return ws.send(createError("Invalid user ID"));

  room.state = await createInternalGameState(
    room.players.map(({ name }) => name),
    room.settings
  );
  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    state: convertGameState(room.state),
    update: "Game started",
    settings: room.settings,
  };
  room.players.forEach(({ socket }, i) => {
    const playerUpdate: UpdateRoomResponse = {
      ...update,
      newCards: room.state?.hands[i],
    };
    socket.send(JSON.stringify(playerUpdate));
  });
  log(`Began game in room ${m.roomID}`);
}

function handleMakeMove(ws: WS.WebSocket, m: MakeMoveMessage) {
  // Cleanup allows us to only mutate state once we are sure the operation can be done
  const cleanup: (() => void)[] = [];

  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  const playerIndex = room.players.findIndex(
    (player) => player.UUID === m.userID
  );

  if (playerIndex === -1) return ws.send(createError("Invalid user ID"));

  if (!room.state) return ws.send(createError("Game not in progress"));

  if (
    room.state.currentTzar !==
    room.players.findIndex(({ UUID }) => m.userID === UUID)
  )
    return ws.send(createError("Cannot make a move when not your turn"));

  const msg: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    state: room.state,
    update: `${room.players[playerIndex].name}`,
  };

  room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));

  // if (isEndOfRound(room.state)) {
  //   const msg: UpdateRoomResponse = {
  //     type: MessageType.UPDATE_ROOM,
  //     update: "Round ended, calculating scores...",
  //   };
  //   room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));
  //   // setTimeout(() => handleEndOfRound(room), 3000);
  // }
}

// function handleEndOfRound(room: Room) {
//   if (!room.state) return;

//   const points = room.state.playerBoards.map(({ score, playerName }) => ({
//     score: -score,
//     playerName,
//   }));

//   room.state = endRound(room.state, room.settings);

//   points.forEach((point, i) => {
//     point.score += room.state?.playerBoards[i].score ?? -point.score;
//   });

//   points.sort((a, b) => b.score - a.score);

//   const msg: UpdateRoomResponse = {
//     type: MessageType.UPDATE_ROOM,
//     state: room.state,
//     update: points
//       .map(
//         ({ playerName, score }) =>
//           `${playerName}: ${score > 0 ? "+" : ""}${score} points`
//       )
//       .join(", "),
//   };

//   room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));

//   if (isEndOfGame(room.state)) {
//     const msg: UpdateRoomResponse = {
//       type: MessageType.UPDATE_ROOM,
//       update: "Game ended, calculating final scores...",
//       state: {
//         ...room.state,
//         currentPlayer: -1,
//       },
//     };
//     room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));
//     setTimeout(() => {
//       handleEndOfGame(room);
//     }, 3000);
//   }
// }

// function handleEndOfGame(room: Room) {
//   if (!room.state) return;
//   const { state, standings } = endGame(room.state, room.settings);
//   const msg: EndGameResponse = {
//     type: MessageType.END_GAME,
//     state,
//     standings,
//   };
//   room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));
// }

function handleUpdateSettings(ws: WS.WebSocket, m: UpdateSettingsMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  if (!m.userID || room.creator.UUID !== m.userID)
    return ws.send(createError("Invalid user ID"));

  room.settings = m.settings;

  const msg: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    update: "Updated settings",
    settings: room.settings,
  };

  room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));
}

function handleEndStandings(ws: WS.WebSocket, m: EndStandingsMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return ws.send(createError("Incorrect room ID"));

  if (!m.userID || room.creator.UUID !== m.userID)
    return ws.send(createError("Invalid user ID"));

  const msg: EndStandingsResponse = {
    type: MessageType.END_STANDINGS,
  };

  room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));

  rooms.delete(m.roomID);

  log(`Ended standings for ${m.roomID}`);
}

app.ws("/ws", (ws) => {
  setTimeout(() => {
    const greeting: AssignUUIDResponse = {
      type: MessageType.ASSIGN_UUID,
      userID: createUUID(),
      visual_cdn,
    };
    ws.send(JSON.stringify(greeting));
    log(`New connection, gave ID ${greeting.userID}`);
  }, 200);

  const timer = setInterval(() => {
    ws.ping(undefined, undefined, (e) => {
      e && clearInterval(timer);
    });
  }, 30000);

  ws.on("message", (msg) => {
    let m: Message;
    try {
      m = JSON.parse(msg as unknown as string) as Message;
    } catch (e) {
      log(msg);
      ws.send(createError("Invalid message"));
      return;
    }
    if (m.type === MessageType.CREATE_ROOM) {
      handleCreateRoom(ws, m);
    } else if (m.type === MessageType.JOIN_ROOM) {
      handleJoinRoom(ws, m);
    } else if (m.type === MessageType.REARRANGE_PLAYERS) {
      handleRearrangePlayers(ws, m);
    } else if (m.type === MessageType.BEGIN) {
      handleBegin(ws, m);
    } else if (m.type === MessageType.MAKE_MOVE) {
      handleMakeMove(ws, m);
    } else if (m.type === MessageType.UPDATE_SETTINGS) {
      handleUpdateSettings(ws, m);
    } else if (m.type === MessageType.END_STANDINGS) {
      handleEndStandings(ws, m);
    } else {
      log(`Unknown message '${msg}'`);
    }
  });
  ws.on("close", (code, reason) => {
    log("close", code, reason);
  });
});

app
  .use(express.static("dist/public"))
  .listen(port, () => log("Server is running"));

// app.listen(, () => log("Server is running"));
