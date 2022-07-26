import express from "express";
import expressWs from "express-ws";
import WS from "ws";
import {
  Message,
  MessageType,
  CreateRoomResponse,
  UpdateRoomResponse,
  JoinRoomResponse,
  ReJoinRoomResponse,
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
  AssignUUIDMessage,
  LookupMessage,
  LookupResponse,
  Move,
  GameStyle,
  VoteMessage,
  UserAndRoom,
} from "./model";
import {
  convertGameState,
  createInternalGameState,
  createSettings,
  setTzar,
  stopTimeout,
} from "./create";
import {
  rooms,
  Player,
  createRoomID,
  createUUID,
  Room,
  isGameInProgress,
} from "./state";
import log from "./log";
import { exit } from "process";
import { bottomtexts, toptexts, visuals } from "./api";
import _ from "lodash";
import { sendOnSocket } from "./utils";
const { app } = expressWs(express());
const port = process.env.PORT || 8080;

const ensureEnv = (key: string): string => {
  const val = process.env[key];
  if (!val) {
    log(`Env variable ${key} not set! Exiting...`);
    log("");
    exit();
  }
  return val;
};

const visual_cdn = ensureEnv("VISUAL_CDN");
// const jwt_secret = ensureEnv("JWT_SECRET");

export function createError(error: string): string {
  const err: ErrorResponse = {
    type: MessageType.ERROR,
    error,
  };
  log(`Encountered error '${error}'`);
  return JSON.stringify(err);
}

type PlayerAndRoom = {
  player: Player;
  playerIndex: number;
  room: Room;
};
/** This ensures that room and player are defined, sending errors if not */
function ensureUserAndRoom(
  ws: WS.WebSocket,
  m: UserAndRoom
): false | PlayerAndRoom {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return void ws.send(createError("Incorrect room ID")), false;

  const playerIndex = room.players.findIndex(({ UUID }) => m.userID === UUID);
  if (playerIndex === -1)
    return void ws.send(createError("Invalid user ID")), false;

  return {
    room,
    playerIndex,
    player: room.players[playerIndex],
  };
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

  const existingIndex = room.players.findIndex(
    (player) => player.name === m.username
  );
  const existing =
    existingIndex === -1 ? undefined : room.players[existingIndex];
  if (existing) {
    const closedStates: (0 | 1 | 2 | 3)[] = [WS.CLOSING, WS.CLOSED];
    // If connection was closed, allow hijacking
    if (closedStates.includes(existing.socket.readyState)) existing.socket = ws;
    else return ws.send(createError("User already in room"));
    // } else if (room.players.length >= 4) {
    //   return ws.send(createError("Room full"));
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
    state: room.state && convertGameState(room.state),
    settings: room.settings,
  };

  if (existing && room.state) {
    sendOnSocket(ws, {
      ...joinRes,
      type: MessageType.REJOIN_ROOM,
      cardUpdate: { type: "replace", ...room.state.hands[existingIndex] },
    });
  } else {
    ws.send(JSON.stringify(joinRes));
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      players: room.players.map(({ name }) => name),
      update: `User ${m.username} joined the room`,
    };
    otherPlayers.forEach((otherPlayer) =>
      otherPlayer.send(JSON.stringify(update))
    );
  }
  log(`Joined room ${m.roomID}${existing ? ", not update" : ""}`);
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

  const state = await createInternalGameState(
    room.players.map(({ name }) => name),
    room.settings
  );
  room.state = state;
  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    state: convertGameState(room.state),
    update: "Game started",
    settings: room.settings,
  };
  room.players.forEach(({ socket }, i) => {
    const playerUpdate: UpdateRoomResponse = {
      ...update,
      cardUpdate: room.state?.hands[i] && {
        ...room.state?.hands[i],
        type: "replace",
      },
    };
    socket.send(JSON.stringify(playerUpdate));
  });
  log(`Began game in room ${m.roomID}`);
  stopTimeout(state);
  state.timeout = setTimeout(() => {
    setTzar(state, room.settings, room.players);
    update.state = convertGameState(state);
    update.update = "Time is up! Moving on to voting.";
    room.players.forEach(({ socket }) => socket.send(JSON.stringify(update)));
  }, room.settings.maxTimer.move + 1000);
}

function handleMakeMove(ws: WS.WebSocket, m: MakeMoveMessage) {
  // Cleanup allows us to only mutate state once we are sure the operation can be done
  const cleanup: (() => void)[] = [];

  const res = ensureUserAndRoom(ws, m);
  if (!res) return;

  const { room, playerIndex, player } = res;

  const state = room.state;
  if (!state) return ws.send(createError("Game not in progress"));

  log({ playerIndex, currentTzar: state.currentTzar });

  if (state.tzarsTurn === (state.currentTzar !== playerIndex))
    return ws.send(createError("Cannot make a move when not your turn"));

  if (state.plays[playerIndex])
    return ws.send(createError("Cannot make additional moves on your turn"));

  if (!room.settings.canOmit.top && !m.move.top)
    return ws.send(createError("Cannot omit top text"));
  if (!room.settings.canOmit.bottom && !m.move.bottom)
    return ws.send(createError("Cannot omit bottom text"));

  let move: Move = { player: m.userID };
  const mt = m.move.top;
  if (mt) {
    const topCardIndex = state.hands[playerIndex].top.findIndex(
      ({ id }) => mt.id === id
    );
    if (topCardIndex === -1)
      return ws.send(
        createError("You do not have the top card you tried to play!")
      );
    move.top = state.hands[playerIndex].top[topCardIndex];
    cleanup.push(() => state.hands[playerIndex].top.splice(topCardIndex, 1));
  }
  const mb = m.move.bottom;
  if (mb) {
    const bottomCardIndex = state.hands[playerIndex].bottom.findIndex(
      ({ id }) => mb.id === id
    );
    if (bottomCardIndex === -1)
      return ws.send(
        createError("You do not have the bottom card you tried to play!")
      );
    move.bottom = state.hands[playerIndex].bottom[bottomCardIndex];
    cleanup.push(() =>
      state.hands[playerIndex].bottom.splice(bottomCardIndex, 1)
    );
  }

  state.plays[playerIndex] = move;

  cleanup.forEach((f) => f());

  const noMovePlayerCount = state.plays.filter((v) => v == null).length;
  let switchCount = room.settings.gameStyle === GameStyle.TZAR ? 1 : 0;
  // If only one player (the tzar) or none (vote) hasn't played, then progress
  if (noMovePlayerCount <= switchCount) {
    stopTimeout(state);
    setTzar(state, room.settings, room.players);
  }

  const msg: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    state: convertGameState(state),
    update: `${player.name} made a move`,
  };

  const response: UpdateRoomResponse = {
    ...msg,
    update: `You made a move`,
    moveState: {
      bottom: mb?.id,
      top: mt?.id,
    },
  };

  for (const { socket, UUID } of room.players) {
    if (m.userID === UUID) {
      socket.send(JSON.stringify(response));
    } else {
      socket.send(JSON.stringify(msg));
    }
  }

  // room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));

  // if (isEndOfRound(room.state)) {
  //   const msg: UpdateRoomResponse = {
  //     type: MessageType.UPDATE_ROOM,
  //     update: "Round ended, calculating scores...",
  //   };
  //   room.players.forEach(({ socket }) => socket.send(JSON.stringify(msg)));
  //   // setTimeout(() => handleEndOfRound(room), 3000);
  // }
}

function handleVote(ws: WS.WebSocket, m: VoteMessage) {
  throw new Error("Function not implemented.");
}

// function handleEndOfRound(room: Room) {
//   if (!room.state) return;

//   const points = room.state.playerBoards.map(({ score, playerName }) => ({
//     score: -score,
//     playerName,
//   }));

//   endRound(room.state, room.settings);

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

function handleAssignUuid(ws: WS.WebSocket, m: AssignUUIDMessage) {
  let userID = m.userID;
  if (!userID) {
    userID = createUUID();
    log(`New connection, gave ID ${userID}`);
  } else {
    const playerID = isGameInProgress(userID, m.roomID);
    const room = rooms.get(m.roomID as string);
    if (playerID && room) {
      const player = room.players[playerID];
      player.socket = ws;
      log("Player is rejoining...");
      setTimeout(() => {
        let cardUpdate: ReJoinRoomResponse["cardUpdate"];
        if (room.state?.hands) {
          cardUpdate = {
            ...room.state.hands[playerID],
            type: "replace",
          };
        }
        const update: ReJoinRoomResponse = {
          type: MessageType.REJOIN_ROOM,
          players: room.players.map(({ name }) => name),
          creator: room.creator.name,
          settings: room.settings,
          state: room.state && convertGameState(room.state),
          roomID: m.roomID as string,
          cardUpdate,
        };
        ws.send(JSON.stringify(update));
      }, 200);
    }
    log(`New connection, recieved ID ${userID}`);
  }
  const greeting: AssignUUIDResponse = {
    type: MessageType.ASSIGN_UUID,
    userID,
    visual_cdn,
  };
  ws.send(JSON.stringify(greeting));
}

function handleLookup(ws: WS.WebSocket, m: LookupMessage) {
  if (m.elementType === "visual") {
    const res: LookupResponse = {
      type: MessageType.LOOKUP,
      elementType: "visual",
      data: visuals.find(
        ({ filename, id }) =>
          (m.data.filename && m.data.filename === filename) || m.data.id === id
      ),
    };
    ws.send(JSON.stringify(res));
  } else {
    const cards = m.elementType === "bottom" ? bottomtexts : toptexts;
    const res: LookupResponse = {
      type: MessageType.LOOKUP,
      elementType: m.elementType,
      data: cards.find(
        ({ text, id }) =>
          (m.data.text && m.data.text === text) || m.data.id === id
      ),
    };
    ws.send(JSON.stringify(res));
  }
}

app.ws("/ws", (ws) => {
  const timer = setInterval(() => {
    ws.ping(undefined, undefined, (error) => {
      error && clearInterval(timer);
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
    if (m.type === MessageType.ASSIGN_UUID) {
      handleAssignUuid(ws, m);
    } else if (m.type === MessageType.CREATE_ROOM) {
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
    } else if (m.type === MessageType.LOOKUP) {
      handleLookup(ws, m);
    } else if (m.type === MessageType.VOTE) {
      handleVote(ws, m);
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
