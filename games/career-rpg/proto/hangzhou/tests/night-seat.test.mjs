import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { inflateSync } from 'node:zlib';
import { NAV } from '../nav.mjs';

const NIGHT = new URL('../art/night-384x216.png', import.meta.url);
const SHEET = new URL('../walk/walk-sheet.png', import.meta.url);
const SEAT = [72, 135, 21, 22];

function decodePng(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 2;
  const parts = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === 'IDAT') parts.push(data);
    else if (type === 'IEND') break;
    offset += 12 + length;
  }
  const channels = colorType === 6 ? 4 : 3;
  const inflated = inflateSync(Buffer.concat(parts));
  const pixels = new Uint8Array(width * height * 4);
  let src = 0;
  let previous = new Uint8Array(width * channels);
  for (let y = 0; y < height; y += 1) {
    const filter = inflated[src];
    src += 1;
    const current = new Uint8Array(width * channels);
    for (let i = 0; i < current.length; i += 1) {
      const left = i >= channels ? current[i - channels] : 0;
      const up = previous[i];
      const upLeft = i >= channels ? previous[i - channels] : 0;
      let value = inflated[src + i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const pa = Math.abs(estimate - left);
        const pb = Math.abs(estimate - up);
        const pc = Math.abs(estimate - upLeft);
        value += (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
      }
      current[i] = value & 255;
    }
    src += current.length;
    for (let x = 0; x < width; x += 1) {
      const source = x * channels;
      const dest = (y * width + x) * 4;
      pixels[dest] = current[source];
      pixels[dest + 1] = current[source + 1];
      pixels[dest + 2] = current[source + 2];
      pixels[dest + 3] = channels === 4 ? current[source + 3] : 255;
    }
    previous = current;
  }
  return { width, height, pixels };
}

function isRed(pixels, index) {
  const red = pixels[index];
  const green = pixels[index + 1];
  const blue = pixels[index + 2];
  return pixels[index + 3] > 20 && red > 100 && green < 80 && blue < 70 && red > green + 40;
}

function redCount(pixels, width, box) {
  const [x0, y0, w, h] = box;
  let count = 0;
  for (let y = y0; y < y0 + h; y += 1) {
    for (let x = x0; x < x0 + w; x += 1) {
      if (isRed(pixels, (y * width + x) * 4)) count += 1;
    }
  }
  return count;
}

function paintSeat(plate, sheet, seated) {
  const out = new Uint8Array(plate.pixels);
  if (!seated) return out;
  const [sx, sy, sw, sh] = NAV.seat.sitFrame;
  const [dx, dy] = NAV.seat.sit;
  for (let y = 0; y < sh; y += 1) {
    for (let x = 0; x < sw; x += 1) {
      const source = ((sy + y) * sheet.width + (sx + x)) * 4;
      if (sheet.pixels[source + 3] < 20) continue;
      const dest = ((dy + y) * plate.width + (dx + x)) * 4;
      out[dest] = sheet.pixels[source];
      out[dest + 1] = sheet.pixels[source + 1];
      out[dest + 2] = sheet.pixels[source + 2];
      out[dest + 3] = 255;
    }
  }
  return out;
}

test('night sitting draws one runtime protagonist and the empty desk stays empty', () => {
  const bytes = readFileSync(NIGHT);
  assert.equal(createHash('sha1').update(bytes).digest('hex'), 'f491a82d369e663de41f246fad7c419a274856c0');
  const plate = decodePng(bytes);
  const sheet = decodePng(readFileSync(SHEET));
  assert.deepEqual([plate.width, plate.height], [384, 216]);
  const seat = [...NAV.seat.sit, ...NAV.seat.sitSize];
  const seated = paintSeat(plate, sheet, true);
  const away = paintSeat(plate, sheet, false);
  assert.ok(redCount(seated, plate.width, seat) > 40, '夜里坐着要画出发红衣服');
  assert.ok(redCount(plate.pixels, plate.width, seat) < 8, '底图上不能再有一个主角');
  assert.equal(redCount(away, plate.width, SEAT), redCount(plate.pixels, plate.width, SEAT));
  let changed = 0;
  for (let i = 0; i < away.length; i += 4) {
    if (away[i] !== plate.pixels[i] || away[i + 1] !== plate.pixels[i + 1]) changed += 1;
  }
  assert.equal(changed, 0, '离开工位后 B1 上不留人');
  const [screenX, screenY, screenW, screenH] = [72, 134, 26, 13];
  let hair = 0;
  for (let y = screenY + screenH - 4; y < screenY + screenH; y += 1) {
    for (let x = screenX; x < screenX + screenW; x += 1) {
      const index = (y * plate.width + x) * 4;
      if (seated[index] !== plate.pixels[index]) hair += 1;
    }
  }
  assert.ok(hair > 0, '头发要压在亮屏下沿');
});
