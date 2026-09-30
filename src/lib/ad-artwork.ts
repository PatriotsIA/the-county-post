// Artwork formats are shared with the PIA ad network, so one creative runs on both.
export const artworkSpecs = {
  square: { label: "Square ad", width: 250, height: 250, use: "color cards, sponsor carousels and in-feed placements" },
  banner: { label: "Wide banner", width: 980, height: 300, use: "section-break banner carousels" },
} as const;
export type ArtworkKind = keyof typeof artworkSpecs;
export type Artwork = { file: File; url: string; width: number; height: number };

export const artworkMaxBytes = 10 * 1024 * 1024;
const artworkTypes = ["image/png", "image/jpeg"];

export function artworkSizeLabel(kind: ArtworkKind) {
  const spec = artworkSpecs[kind];
  return `${spec.width}×${spec.height}`;
}

/** Decodes the image and checks type, size and proportions; higher-resolution files at the same ratio are accepted. */
export async function readArtwork(file: File, kind: ArtworkKind): Promise<Artwork> {
  const spec = artworkSpecs[kind];
  if (!artworkTypes.includes(file.type)) throw new Error("Artwork must be a PNG or JPG image.");
  if (file.size > artworkMaxBytes) throw new Error("Artwork files must be 10 MB or smaller.");
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("This image could not be opened. Please choose another file.");
  }
  const { naturalWidth: width, naturalHeight: height } = image;
  if (width * spec.height !== height * spec.width || width < spec.width) {
    URL.revokeObjectURL(url);
    throw new Error(`${spec.label} artwork must be ${artworkSizeLabel(kind)} pixels (or a larger image with the same proportions). This file is ${width}×${height}.`);
  }
  return { file, url, width, height };
}
