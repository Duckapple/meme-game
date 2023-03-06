import fetch from "node-fetch";
import { exit } from "process";
import log from "./log";
import type { FullCard, Visual } from "./model";

const api = process.env.MEME_API_URL;

if (!api) {
  log("MEME_API_URL was not defined in environment variables");
  exit();
}

export let toptexts: FullCard[];
export let bottomtexts: FullCard[];
export let visuals: Visual[];

export let lastRefresh: number;

type ApiMemeText = { id: number; memetext: string };

export async function refresh() {
  if (!lastRefresh || lastRefresh + 1000 * 60 < +new Date()) {
    lastRefresh = +new Date();
    log("Refreshing content...");
    const toptextsText = await (await fetch(api + "/toptexts")).text();

    toptexts = (JSON.parse(toptextsText) as ApiMemeText[])
      .map((x) => ({ id: x.id, text: x.memetext }))
      .filter(({ text }) => text);

    const bottomtextsText = await (await fetch(api + "/bottomtexts")).text();
    bottomtexts = (JSON.parse(bottomtextsText) as ApiMemeText[])
      .map((x) => ({
        id: x.id,
        text: x.memetext,
      }))
      .filter(({ text }) => text);

    visuals = JSON.parse(await (await fetch(api + "/visuals")).text());
  }
}
