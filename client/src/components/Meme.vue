<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import type { GameSettings } from "../model";
import { visual_cdn } from "../state";
const props = defineProps<{
  visual: string;
  top?: { text?: string } | null;
  bottom?: { text?: string } | null;
  imageMode?: GameSettings["imageMode"];
  provideImage?: (canvas: HTMLCanvasElement) => void;
  shouldProvideImage?: boolean;
}>();

const CANVAS_SIZE = 1000;

const visualUrl = computed(() => {
  return props.visual ? visual_cdn.value + props.visual : undefined;
});
const visual = ref<{ image?: HTMLImageElement; url?: string }>({});
const hasLoaded = ref(false);

const canvas = ref<HTMLCanvasElement>();
async function redraw() {
  let promise: Promise<HTMLImageElement | any | undefined>;
  if (visualUrl.value && visual.value.url !== visualUrl.value) {
    const url = visualUrl.value;
    promise = new Promise((res) => {
      visual.value.url = visualUrl.value;
      visual.value.image = undefined;
      const image = new Image();
      image.crossOrigin = "anonymous";
      image.src = url;
      image.addEventListener("load", () => {
        visual.value.image = image;
        res(image);
      });
    });
  } else {
    promise = Promise.resolve(visual.value.image);
  }
  const image = (await promise) as HTMLImageElement;
  const cvs = canvas.value;
  const ctx = cvs?.getContext("2d");
  if (!cvs || !ctx || !image) return;
  const hRatio = cvs.width / image.width;
  const vRatio = cvs.height / image.height;
  const ratio = Math.min(hRatio, vRatio);
  const centerShift_x = (cvs.width - image.width * ratio) / 2;
  const centerShift_y = (cvs.height - image.height * ratio) / 2;
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (props.imageMode === "scale") {
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      centerShift_x,
      centerShift_y,
      image.width * ratio,
      image.height * ratio
    );
  } else {
    ctx.drawImage(image, 0, 0, cvs.width, cvs.height);
  }
  ctx.textAlign = "center";
  ctx.font = `${CANVAS_SIZE / 20}px Impacto`;
  ctx.fillStyle = "white";
  ctx.strokeStyle = "black";
  ctx.lineWidth = CANVAS_SIZE / 200;
  const top = props.top;
  const textMaxWidth =
    props.imageMode === "scale" ? image.width * ratio : cvs.width;
  if (top) {
    ctx.strokeText(
      top.text?.toUpperCase() ?? "",
      cvs.width / 2,
      (1.5 * CANVAS_SIZE) / 20,
      textMaxWidth - CANVAS_SIZE / 20
    );
    ctx.fillText(
      top.text?.toUpperCase() ?? "",
      cvs.width / 2,
      (1.5 * CANVAS_SIZE) / 20,
      textMaxWidth - CANVAS_SIZE / 20
    );
  }
  const bottom = props.bottom;
  if (bottom) {
    ctx.strokeText(
      bottom.text?.toUpperCase() ?? "",
      cvs.width / 2,
      CANVAS_SIZE - (0.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
    );
    ctx.fillText(
      bottom.text?.toUpperCase() ?? "",
      cvs.width / 2,
      CANVAS_SIZE - (0.5 * CANVAS_SIZE) / 20,
      image.width * ratio - CANVAS_SIZE / 20
    );
  }
}
watch(
  [
    canvas,
    visual,
    () => props.visual,
    () => props.bottom,
    () => props.top,
    hasLoaded,
  ],
  () => redraw()
);
watch([() => props.shouldProvideImage], ([should]) => {
  try {
    if (canvas.value && props.provideImage && should)
      props.provideImage(canvas.value);
  } catch (e) {
    console.error(e);
  }
});
</script>

<template>
  <canvas
    ref="canvas"
    class="font-[Impacto] aspect-square max-h-full max-w-full block"
    :height="CANVAS_SIZE"
    :width="CANVAS_SIZE"
  >
    This no workey :(
  </canvas>
</template>
