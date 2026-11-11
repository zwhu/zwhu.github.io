// 字符串种子 → uint32，同一字符串在任何引擎里得到同一个起点。
export function hashSeed(text) {
  let hash = 2166136261;
  const source = String(text);
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) || 1;
}

// mulberry32。state 可序列化，方便纯函数把整局存下来再接着掷。
export function rngNext(state) {
  let x = state | 0;
  x = (x + 0x6D2B79F5) | 0;
  let t = Math.imul(x ^ (x >>> 15), 1 | x);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const next = (t ^ (t >>> 14)) >>> 0;
  return { state: next, value: next / 4294967296 };
}

export function rngInt(state, min, max) {
  const roll = rngNext(state);
  const span = max - min + 1;
  return { state: roll.state, value: min + Math.floor(roll.value * span) };
}
