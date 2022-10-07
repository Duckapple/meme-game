import { reactive, ref } from "vue";

let host = location.origin.replace(/^http/, "ws");
if (host.match("ws://localhost")) host = "ws://localhost:8080";
if (process.env.NODE_ENV !== "production") {
  host = host.replace(":3000", ":8080");
}

function createWS(): WebSocket {
  const theWs = new WebSocket(host + "/ws");
  return theWs;
}

export const ws = reactive(createWS());
