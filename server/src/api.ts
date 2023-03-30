import fetch from "node-fetch";
import { exit } from "process";
import z from "zod";
import log from "./log";
import type { FullCard, Visual } from "./model";
import _ from "lodash";
const { uniqBy, difference } = _;

const api = process.env.MEME_API_URL;

const FORCE = true;

if (!api) {
  log("MEME_API_URL was not defined in environment variables");
  exit();
}

const oldApiMemeText = z.object({
  id: z.number(),
  memetext: z.string(),
});

const oldVisual = z.object({
  id: z.number(),
  filename: z.string(),
});

export let toptexts: FullCard[];
export let bottomtexts: FullCard[];
export let visuals: Visual[];

export let lastRefresh: number;

enum ApiPosition {
  TOP = 0,
  BOTTOM = 1,
}

const apiMemeText = z.object({
  id: z.number(),
  text: z.string().nullable(),
});
const apiMemeTopText = apiMemeText.extend({
  position: z.literal(ApiPosition.TOP),
});
const apiMemeBottomText = apiMemeText.extend({
  position: z.literal(ApiPosition.BOTTOM),
});
const visual = z.object({
  id: z.number(),
  filename: z.string().nullable(),
});

export async function refresh() {
  if (!lastRefresh || lastRefresh + 1000 * 60 < +new Date()) {
    lastRefresh = +new Date();
    log("Refreshing content...");
    let toptextsText: unknown;
    try {
      toptextsText = await (
        await fetch(`${api}/Texts/${ApiPosition.TOP}`)
      ).json();
    } catch {
      log("New API doesn't work, falling back to old API standard");
      return oldRefresh(FORCE);
    }

    toptexts = apiMemeTopText
      .array()
      .parse(toptextsText)
      .map((x) => ({ id: x.id, text: x.text }))
      .filter((x): x is FullCard => !!x.text);

    const bottomtextsText = await (
      await fetch(`${api}/Texts/${ApiPosition.BOTTOM}`)
    ).json();
    bottomtexts = apiMemeBottomText
      .array()
      .parse(bottomtextsText)
      .map((x) => ({ id: x.id, text: x.text }))
      .filter((x): x is FullCard => !!x.text);

    const visualsText = await (await fetch(api + "/Visuals")).json();
    visuals = visual
      .array()
      .parse(visualsText)
      .filter((x): x is Visual => !!x.filename);
  }
}

export async function oldRefresh(force = false) {
  if (force || !lastRefresh || lastRefresh + 1000 * 60 < +new Date()) {
    lastRefresh = +new Date();
    log("Refreshing content...");
    const toptextsText = await (await fetch(api + "/toptexts")).json();

    toptexts = oldApiMemeText
      .array()
      .parse(toptextsText)
      .map((x) => ({ id: x.id, text: x.memetext }))
      .filter(({ text }) => text);

    const bottomtextsText = await (await fetch(api + "/bottomtexts")).json();
    bottomtexts = oldApiMemeText
      .array()
      .parse(bottomtextsText)
      .map((x) => ({
        id: x.id,
        text: x.memetext,
      }))
      .filter(({ text }) => text);

    visuals = oldVisual
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

const createTextDTO = z.object({
  text: z.string().min(1),
  position: z.literal(ApiPosition.TOP).or(z.literal(ApiPosition.BOTTOM)),
});

export async function submit(
  endpoint: "toptexts" | "bottomtexts",
  data: Omit<z.infer<typeof createTextDTO>, "position">
) {
  const position =
    endpoint === "toptexts" ? ApiPosition.TOP : ApiPosition.BOTTOM;
  const body = JSON.stringify({
    ...data,
    position,
  } satisfies z.infer<typeof createTextDTO>);
  try {
    const res = await (
      await fetch(`${api}/Texts/`, {
        body,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    ).json();
    log(
      `Submitted '${JSON.stringify(
        body
      )}' to '${endpoint}' with response '${JSON.stringify(res)}'`
    );
    return (endpoint === "toptexts" ? apiMemeTopText : apiMemeBottomText).parse(
      res
    );
  } catch (err) {
    log("Falling back to old submit");
    return oldSubmit(endpoint, { memetext: data.text });
  }
}

export function oldSubmit(
  endpoint: "visuals",
  data: Omit<z.infer<typeof oldVisual>, "id">
): Promise<void>;
export function oldSubmit(
  endpoint: "toptexts" | "bottomtexts",
  data: Omit<z.infer<typeof oldApiMemeText>, "id">
): Promise<void>;
export async function oldSubmit(endpoint: string, body: any) {
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
  } catch (err) {
    log("Could not submit, for some reason");
  }
}
