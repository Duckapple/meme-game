import fetch from "node-fetch";
import { exit } from "process";
import z from "zod";
import log from "./log";
import type { FullCard, Visual } from "./model";
import _ from "lodash";
const { uniqBy, difference } = _;

const api = process.env.MEME_API_URL;

if (!api) {
  log("MEME_API_URL was not defined in environment variables");
  exit();
}

const apiMemeText = z.object({
  id: z.number(),
  memetext: z.string(),
});

const visual = z.object({
  id: z.number(),
  filename: z.string(),
});

export let toptexts: FullCard[];
export let bottomtexts: FullCard[];
export let visuals: Visual[];

export let lastRefresh: number;

export async function refresh() {
  if (!lastRefresh || lastRefresh + 1000 * 60 < +new Date()) {
    lastRefresh = +new Date();
    log("Refreshing content...");
    const toptextsText = await (await fetch(api + "/toptexts")).json();

    toptexts = apiMemeText
      .array()
      .parse(toptextsText)
      .map((x) => ({ id: x.id, text: x.memetext }))
      .filter(({ text }) => text);

    const bottomtextsText = await (await fetch(api + "/bottomtexts")).json();
    bottomtexts = apiMemeText
      .array()
      .parse(bottomtextsText)
      .map((x) => ({
        id: x.id,
        text: x.memetext,
      }))
      .filter(({ text }) => text);

    visuals = visual
      .array()
      .parse(await (await fetch(api + "/visuals")).json());

    const uTop = uniqBy(toptexts, "text");
    if (uTop.length !== toptexts.length) {
      log("Duplicate toptexts: " + JSON.stringify(difference(toptexts, uTop)));
    }
    const uBot = uniqBy(bottomtexts, "text");
    if (uBot.length !== bottomtexts.length) {
      log(
        "Duplicate bottomtexts: " +
          JSON.stringify(difference(bottomtexts, uBot))
      );
    }
    const uVis = uniqBy(visuals, "filename");
    if (uVis.length !== visuals.length) {
      log("Duplicate visuals: " + JSON.stringify(difference(visuals, uVis)));
    }
  }
}

export function submit(
  endpoint: "visuals",
  data: Omit<z.infer<typeof visual>, "id">
): Promise<void>;
export function submit(
  endpoint: "toptexts" | "bottomtexts",
  data: Omit<z.infer<typeof apiMemeText>, "id">
): Promise<void>;
export async function submit(endpoint: string, body: any) {
  log(`Submitted '${JSON.stringify(body)}' to '${endpoint}'`);
  try {
    log(
      await (
        await fetch(`${api}/${endpoint}`, {
          body: JSON.stringify(body),
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          method: "POST",
        })
      ).json()
    );
  } catch (err) {}
}
