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

export let ws = ref<WebSocket>(createWS());

type SubType = Parameters<WebSocket["addEventListener"]>;

export const subscriptions = reactive<SubType[]>([["close", handleReconnect]]);

function handleReconnect() {
  ws.value = createWS();
  mountSubscriptions();
}

export function mountSubscriptions() {
  console.log("Subbing with", subscriptions.length, "subscribers");
  for (const sub of subscriptions) {
    ws.value.addEventListener(...sub);
  }
}
