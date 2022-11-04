import WS from "ws";
import { MessageResponse } from "./model";

export function sendOnSocket(ws: WS.WebSocket, m: MessageResponse) {
  ws.send(JSON.stringify(m));
}
