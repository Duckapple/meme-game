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
  WithUser,
  WithRoom,
  WithAdminOverride,
  AdminMergeStateMessage,
  DoneVotingMessage,
} from "./model";
import {
  convertGameState,
  createInternalGameState,
  createSettings,
  setStandings,
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
  InternalGameState,
} from "./state";
import log from "./log";
import { exit } from "process";
import { bottomtexts, submit, toptexts, visuals } from "./api";
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
const apiOverride = process.env.API_OVERRIDE;
const hasOverride = !!apiOverride;

export function sendError(ws: WS.WebSocket, error: string, data?: unknown) {
  const err: ErrorResponse = {
    type: MessageType.ERROR,
    error,
    data,
  };
  log(`Encountered error '${error}'`);
  return sendOnSocket(ws, err);
}

function validateOverride(ws: WS.WebSocket, msg: WithAdminOverride) {
  if (!hasOverride) return sendError(ws, "API override not set"), false;
  // Do not inform the user they are wrong or not
  return msg.adminKey === apiOverride;
}

type PlayerAndRoom = {
  player: Player;
  playerIndex: number;
  room: Room;
};
/** This ensures that room and player are defined, sending errors if not */
function ensurePlayerAndRoom(
  ws: WS.WebSocket,
  m: WithUser & WithRoom
): false | PlayerAndRoom {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return void sendError(ws, "Incorrect room ID"), false;

  const playerIndex = room.players.findIndex(({ UUID }) => m.userID === UUID);
  if (playerIndex === -1) return void sendError(ws, "Invalid user ID"), false;

  return {
    room,
    playerIndex,
    player: room.players[playerIndex],
  };
}

function handleCreateRoom(ws: WS.WebSocket, m: CreateRoomMessage) {
  if (!m.userID || !m.username) return sendError(ws, "No user ID");

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
  sendOnSocket(ws, res);
  log(`Created room ${roomID}`);
}

function handleJoinRoom(ws: WS.WebSocket, m: JoinRoomMessage) {
  if (!m.userID || !m.username) return sendError(ws, "No user ID");
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return sendError(ws, "Incorrect room ID");

  const existingIndex = room.players.findIndex(
    (player) => player.name === m.username
  );
  const existing =
    existingIndex === -1 ? undefined : room.players[existingIndex];
  if (existing) {
    const closedStates: (0 | 1 | 2 | 3)[] = [WS.CLOSING, WS.CLOSED];
    // If connection was closed, allow hijacking
    if (closedStates.includes(existing.socket.readyState)) existing.socket = ws;
    else return sendError(ws, "User already in room");
    // } else if (room.players.length >= 4) {
    //   return sendError(ws, "Room full");
  } else if (room.state) {
    return sendError(ws, "Game already in progress");
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
    sendOnSocket(ws, joinRes);
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      players: room.players.map(({ name }) => name),
      update: `User ${m.username} joined the room`,
    };
    otherPlayers.forEach((otherPlayer) => sendOnSocket(otherPlayer, update));
  }
  log(`Joined room ${m.roomID}${existing ? ", not update" : ""}`);
}
function handleRearrangePlayers(ws: WS.WebSocket, m: RearrangePlayersMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return sendError(ws, "Incorrect room ID");

  if (!m.userID || room.creator.UUID !== m.userID)
    return sendError(ws, "Invalid user ID");

  let check = true;
  const playerCheck = room.players.map(({ name }) => name);
  m.players.forEach((player) => {
    const other = playerCheck.findIndex((other) => other === player);
    if (other === -1) check = false;
    playerCheck.splice(other, 1);
  });

  if (!check || playerCheck.length > 0)
    return sendError(ws, "Invalid player list");

  let worked = true;
  const reordered = m.players.map((name) => {
    const player = room.players.find(({ name: n }) => name === n);
    if (!player) worked = false;
    return player as Player;
  });
  if (!worked) return sendError(ws, "Could not reorder players");

  room.players = reordered;

  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    players: reordered.map(({ name }) => name),
    update: "Rearranged players",
  };
  reordered.forEach(({ socket }) => sendOnSocket(socket, update));
  log(`Rearranged players in room ${m.roomID}`);
}

async function handleBegin(ws: WS.WebSocket, m: BeginMessage) {
  const room = rooms.get(m.roomID);

  if (!m.roomID || !rooms.has(m.roomID) || !room)
    return sendError(ws, "Incorrect room ID");

  if (!m.userID || room.creator.UUID !== m.userID)
    return sendError(ws, "Invalid user ID");

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
    sendOnSocket(socket, playerUpdate);
  });
  log(`Began game in room ${m.roomID}`);
  stopTimeout(state);
  state.timeout = setTimeout(() => {
    setTzar(state, room.settings, room.players);
    update.update = "Time is up! Moving on to voting.";
    room.players.forEach(({ socket, name }) =>
      socket.send(
        JSON.stringify({ ...update, state: convertGameState(state, name) })
      )
    );
  }, room.settings.maxTimer.move + 1000);
}

function handleMakeMove(ws: WS.WebSocket, m: MakeMoveMessage) {
  // Cleanup allows us to only mutate state once we are sure the operation can be done
  const cleanup: (() => void)[] = [];

  const playerAndRoom = ensurePlayerAndRoom(ws, m);
  if (!playerAndRoom) return;

  const { room, playerIndex, player } = playerAndRoom;

  const state = room.state;
  if (!state) return sendError(ws, "Game not in progress");

  log({ playerIndex, currentTzar: state.currentTzar });

  if (state.phase !== "move")
    return sendError(ws, "Cannot make a move when not your turn");

  if (state.plays[playerIndex])
    return sendError(ws, "Cannot make additional moves on your turn");

  if (!room.settings.canOmit.top && !m.move.top)
    return sendError(ws, "Cannot omit top text");
  if (!room.settings.canOmit.bottom && !m.move.bottom)
    return sendError(ws, "Cannot omit bottom text");

  let move: Move = { player: player.name };
  const mt = m.move.top;
  if (mt) {
    const topCardIndex = state.hands[playerIndex].top.findIndex(
      ({ id }) => mt.id === id
    );
    if (topCardIndex === -1)
      return sendError(ws, "You do not have the top card you tried to play!");
    move.top = { ...state.hands[playerIndex].top[topCardIndex] };
    if (mt.id === -1 && !mt.text)
      return sendError(ws, "Top card is blank, but you didn't provide text!");
    if (mt.id === -1) move.top.text = mt.text ?? "";
    cleanup.push(() => state.hands[playerIndex].top.splice(topCardIndex, 1));
  }
  const mb = m.move.bottom;
  if (mb) {
    const bottomCardIndex = state.hands[playerIndex].bottom.findIndex(
      ({ id }) => mb.id === id
    );
    if (bottomCardIndex === -1)
      return sendError(
        ws,
        "You do not have the bottom card you tried to play!"
      );
    move.bottom = { ...state.hands[playerIndex].bottom[bottomCardIndex] };
    if (mb.id === -1 && !mb.text)
      return sendError(
        ws,
        "Bottom card is blank, but you didn't provide text!"
      );
    if (mb.id === -1) move.bottom.text = mb.text ?? "";
    cleanup.push(() =>
      state.hands[playerIndex].bottom.splice(bottomCardIndex, 1)
    );
  }

  state.plays[playerIndex] = move;

  cleanup.forEach((f) => f());

  void Promise.all(
    (["top", "bottom"] as const)
      .filter((side) => move[side]?.id === -1 && move[side]?.text)
      .map((side) =>
        move[side]?.text
          ? submit(`${side}texts`, { memetext: move[side]?.text ?? "" })
          : Promise.resolve()
      )
  );

  const noMovePlayerCount = state.plays.filter((v) => v == null).length;
  let switchCount = room.settings.gameStyle === GameStyle.TZAR ? 1 : 0;
  // If only one player (the tzar) or none (vote) hasn't played, then progress
  if (noMovePlayerCount <= switchCount) {
    stopTimeout(state);
    setTzar(state, room.settings, room.players);
  }

  const msg: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    update: `${player.name} made a move`,
  };

  const response: UpdateRoomResponse = {
    ...msg,
    state: convertGameState(state, player.name),
    update: `You made a move`,
    moveState: {
      bottom: mb?.id,
      top: mt?.id,
    },
  };

  for (const { socket, UUID, name } of room.players) {
    if (m.userID === UUID) {
      sendOnSocket(socket, response);
    } else {
      sendOnSocket(socket, { ...msg, state: convertGameState(state, name) });
    }
  }
}

function handleVote(ws: WS.WebSocket, m: VoteMessage) {
  const playerAndRoom = ensurePlayerAndRoom(ws, m);
  if (!playerAndRoom) return;
  const { room, playerIndex, player } = playerAndRoom;
  const state = room.state;
  if (!state) return sendError(ws, "Cannot vote on game not in progress.");
  if (!state.phase)
    return sendError(ws, "Cannot vote when not in voting phase");
  if (room.settings.gameStyle === "TZAR" && playerIndex !== state.currentTzar)
    return sendError(ws, "Cannot vote when not Tzar");
  if (state.shuffle[m.playIndex] === playerIndex)
    // Don't care to notify player
    return sendError(ws, "Can't vote for yourself!");
  if (m.voteState) {
    state.votes[m.playIndex].add(m.userID);
  } else {
    state.votes[m.playIndex].delete(m.userID);
  }
}

function handleDoneVoting(ws: WS.WebSocket, m: DoneVotingMessage) {
  const playerAndRoom = ensurePlayerAndRoom(ws, m);
  if (!playerAndRoom) return;
  const { room, playerIndex, player } = playerAndRoom;

  const doneVotingState = room.state?.doneVoting;
  if (room.state?.phase !== "vote" || !doneVotingState)
    return sendError(ws, "Cannot be done voting when not in voting phase!");

  doneVotingState[playerIndex] = true;

  const doneVotingCount = doneVotingState.filter(Boolean).length;
  const update: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    update: `${doneVotingCount} ha${
      doneVotingCount === 1 ? "s" : "ve"
    } voted to skip`,
  };
  // Skip forward if all vote to skip
  if (doneVotingCount === doneVotingState.length) {
    stopTimeout(room.state);
    setStandings(room.state, room.settings, room.players);
    const update: UpdateRoomResponse = {
      type: MessageType.UPDATE_ROOM,
      update: "Voting was skipped! Moving on to standings.",
      state: convertGameState(room.state),
      moveState: null,
    };
    room.players.forEach(({ socket }) => sendOnSocket(socket, update));
    return;
  }
  // We do not notify anyone but this user if less than half are done
  if (doneVotingCount < doneVotingState.length / 2) {
    return sendOnSocket(player.socket, update);
  }
  room.players.forEach(({ socket }) => sendOnSocket(socket, update));
}

function handleUpdateSettings(ws: WS.WebSocket, m: UpdateSettingsMessage) {
  const res = ensurePlayerAndRoom(ws, m);
  if (!res) return;
  const { room, player } = res;

  if (room.creator.UUID !== player.UUID)
    return sendError(ws, "Invalid user ID");

  room.settings = m.settings;

  const msg: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    update: "Updated settings",
    settings: room.settings,
  };

  room.players.forEach(({ socket }) => sendOnSocket(socket, msg));
}

function handleEndStandings(ws: WS.WebSocket, m: EndStandingsMessage) {
  const res = ensurePlayerAndRoom(ws, m);
  if (!res) return;
  const { room, player } = res;

  if (room.creator.UUID !== player.UUID)
    return sendError(ws, "Invalid user ID");

  const msg: EndStandingsResponse = {
    type: MessageType.END_STANDINGS,
  };

  room.players.forEach(({ socket }) => sendOnSocket(socket, msg));

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
        sendOnSocket(ws, update);
      }, 200);
    }
    log(`New connection, recieved ID ${userID}`);
  }
  const greeting: AssignUUIDResponse = {
    type: MessageType.ASSIGN_UUID,
    userID,
    visual_cdn,
  };
  sendOnSocket(ws, greeting);
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
    sendOnSocket(ws, res);
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
    sendOnSocket(ws, res);
  }
}

async function handleAdminMergeState(
  ws: WS.WebSocket,
  m: AdminMergeStateMessage
) {
  const room = rooms.get(m.roomID);
  if (!room) return sendError(ws, "Invalid Room ID");
  const state = room.state;
  if (!state)
    return sendError(ws, "Cannot change state on non-initialized state");
  for (const [k, v] of Object.entries<any>(m.state)) {
    (state as any)[k] = v;
  }
  const res: UpdateRoomResponse = {
    type: MessageType.UPDATE_ROOM,
    update: m.update || "Room updated",
  };
  room.players.forEach(({ socket, name }) =>
    sendOnSocket(socket, { ...res, state: convertGameState(state, name) })
  );
}

app.ws("/ws", (ws) => {
  const timer = setInterval(() => {
    ws.ping(undefined, undefined, (error) => {
      error && clearInterval(timer);
    });
  }, 15000);

  ws.on("message", (msg) => {
    let m: Message;
    try {
      m = JSON.parse(msg as unknown as string) as Message;
    } catch (e) {
      log(msg);
      sendError(ws, "Invalid message");
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
    } else if (m.type === MessageType.DONE_VOTING) {
      handleDoneVoting(ws, m);
    } else if (m.type === MessageType.ADMIN_MERGE_STATE) {
      if (!validateOverride(ws, m)) return;
      handleAdminMergeState(ws, m);
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
