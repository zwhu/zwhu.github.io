const FACING = ['down', 'up', 'left', 'right'];

export function imageURL(image) {
  if (!image) return '';
  if (image.startsWith('.') || image.startsWith('/') || image.includes('/')) return image;
  return `./walk/${image}`;
}

function normalize(entry, sheet) {
  const frames = entry.frames || [];
  const first = frames[0] || { x: 0, y: 0, w: 28, h: 44 };
  return {
    image: imageURL(entry.image),
    mirror: entry.mirror === true,
    anchor: entry.anchor || { x: 14, y: 43 },
    imageSize: entry.imageSize || { w: first.w, h: first.h },
    frameMs: entry.frameMs || sheet.frameMs || 160,
    frames,
  };
}

function firstSprite(sheet) {
  for (const facing of FACING) {
    const entry = sheet.directions?.[facing];
    if (entry?.frames?.length) return entry;
  }
  return null;
}

export function resolveSprite(sheet, facing) {
  const name = FACING.includes(facing) ? facing : 'down';
  const direct = sheet.directions?.[name];
  if (direct?.frames?.length) return normalize(direct, sheet);
  const rule = sheet.fallback?.[name];
  const used = rule?.use ? sheet.directions?.[rule.use] : null;
  const base = used?.frames?.length ? used : firstSprite(sheet);
  if (!base?.frames?.length) {
    return normalize({ image: '', mirror: false, frames: [{ x: 0, y: 0, w: 28, h: 44 }] }, sheet);
  }
  return normalize({ ...base, mirror: rule?.mirror === true }, sheet);
}

export function frameIndex(sprite, elapsedMs) {
  const count = sprite.frames.length;
  if (count <= 1) return 0;
  const ms = sprite.frameMs > 0 ? sprite.frameMs : 160;
  return Math.floor(Math.max(0, elapsedMs) / ms) % count;
}
