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

export async function refresh() {
  if (!lastRefresh || lastRefresh + 1000 * 60 < +new Date()) {
    lastRefresh = +new Date();
    log("Refreshing content...");
    const toptextsText = await (await fetch(api + "/toptexts")).text();
    log(toptextsText);

    toptexts = JSON.parse(toptextsText).map(
      (x: { id: number; memetext: string }) => ({ id: x.id, text: x.memetext })
    );

    bottomtexts = JSON.parse(
      await (await fetch(api + "/bottomtexts")).text()
    ).map((x: { id: number; memetext: string }) => ({
      id: x.id,
      text: x.memetext,
    }));

    visuals = JSON.parse(await (await fetch(api + "/visuals")).text());
  }
}
