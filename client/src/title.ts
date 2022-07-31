export function setTitle(title?: string) {
  const subtitle = "Meme Game";
  document.title = title ? `${title} | ${subtitle}` : subtitle;
}
