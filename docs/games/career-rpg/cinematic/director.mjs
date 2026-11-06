// Recording mode for ?cinematic=<chapter>. Normal play never constructs a director.
// One JSON per chapter lives in ./cinematic/<id>.json. Shots are only
// push-in, pull-out, pan, and follow. Push-ins move in whole pixels.

export const SHOT_TYPES = ['push-in', 'pull-out', 'pan', 'follow'];
const CHAPTERS = ['hefei', 'nanjing', 'hangzhou'];

export function sceneRequest(search) {
  const params = new URLSearchParams(search);
  const cinematic = params.get('cinematic');
  const chapter = params.get('chapter');
  const known = CHAPTERS.includes(cinematic);
  return {cinematic: known ? cinematic : null, chapter: known ? cinematic : chapter};
}

export function wholeLerp(from, to, t) {
  if (t <= 0) return from;
  if (t >= 1) return to;
  return Math.round(from + (to - from) * t);
}

export function lerpView(from, to, t) {
  return {
    x: wholeLerp(from.x, to.x, t),
    y: wholeLerp(from.y, to.y, t),
    size: Math.max(1, wholeLerp(from.size, to.size, t)),
  };
}

export function clampView(view, room) {
  const size = Math.max(1, Math.min(view.size, room.width, room.height));
  return {
    size,
    x: Math.max(0, Math.min(room.width - size, view.x)),
    y: Math.max(0, Math.min(room.height - size, view.y)),
  };
}

export function followTarget(feet, size, room, bias) {
  return clampView({
    x: Math.round(feet.x) - Math.floor(size / 2),
    y: Math.round(feet.y - bias) - Math.floor(size / 2),
    size,
  }, room);
}

// At most one pixel on each axis. A still subject does not move the frame.
export function stepFollow(current, target) {
  const toward = (a, b) => a === b ? a : a + Math.sign(b - a);
  return {x: toward(current.x, target.x), y: toward(current.y, target.y), size: current.size};
}

export function walkIntent(position, target, blockedAt) {
  const dx = target[0] - position.x, dy = target[1] - position.y;
  if (Math.hypot(dx, dy) <= 0.5) return null;
  const options = [];
  if (Math.abs(dx) >= Math.abs(dy) && dx) options.push([Math.sign(dx), 0]);
  else if (dy) options.push([0, Math.sign(dy)]);
  if (options.length && options[0][0] && dy) options.push([0, Math.sign(dy)]);
  else if (options.length && options[0][1] && dx) options.push([Math.sign(dx), 0]);
  for (const [mx, my] of options) {
    if (!blockedAt(position.x + (mx || 0), position.y + (my || 0))) return [mx, my];
  }
  return null;
}

export function validateScript(script) {
  if (!script || !Array.isArray(script.shots) || !Array.isArray(script.route)) throw new Error('script needs shots and route');
  if (!(script.output > 0)) throw new Error('script output');
  if (!script.room || !(script.room.width > 0) || !(script.room.height > 0)) throw new Error('script room');
  if (!script.opening) throw new Error('script opening');
  const ids = new Set();
  for (const shot of script.shots) {
    if (!SHOT_TYPES.includes(shot.type)) throw new Error('shot type ' + shot.type);
    if (!shot.id || ids.has(shot.id)) throw new Error('shot id ' + shot.id);
    ids.add(shot.id);
    if (shot.type === 'follow') {
      if (!(shot.size > 0)) throw new Error(shot.id + ' size');
    } else {
      if (!(shot.frames > 0) || !shot.to) throw new Error(shot.id + ' frames');
      if (shot.type !== 'pan' && !(shot.to.size > 0)) throw new Error(shot.id + ' to.size');
    }
  }
  for (const step of script.route) {
    if (step.do === 'shot' && !ids.has(step.id)) throw new Error('missing shot ' + step.id);
  }
  return script;
}

function viewOf(rect) {
  return {x: rect.x | 0, y: rect.y | 0, size: rect.size | 0};
}

export function createDirector(script) {
  validateScript(script);
  const shots = Object.fromEntries(script.shots.map(shot => [shot.id, shot]));
  const room = script.room;
  let view = viewOf(script.opening);
  let index = 0;
  let phase = 'route';
  let cameraMode = 'fixed';
  let tween = null;
  let follow = null;
  let holdLeft = 0;
  let walkTo = null;
  let wait = null;
  let wish = null;
  let stuck = 0;
  let lastX = null;
  let lastY = null;
  let polls = 0;
  const played = [];
  const stills = [];
  let shotId = null;

  function matches(api, spec) {
    if (spec.until && api.state() !== spec.until) return false;
    if (spec.button && !api.buttons().some(text => text.includes(spec.button))) return false;
    return true;
  }

  function startShot(shot, frame) {
    shotId = shot.id;
    played.push({id: shot.id, type: shot.type, frame});
    if (shot.type === 'follow') {
      if (shot.size !== view.size) throw new Error(shot.id + ' follow size ' + shot.size + ' != ' + view.size);
      follow = {size: shot.size, bias: shot.bias ?? 20};
      cameraMode = 'follow';
      tween = null;
      return;
    }
    const to = viewOf({
      x: shot.to.x,
      y: shot.to.y,
      size: shot.type === 'pan' ? view.size : shot.to.size,
    });
    if (shot.type === 'pan' && shot.to.size != null && shot.to.size !== view.size) throw new Error(shot.id + ' pan keeps size');
    if (shot.type === 'push-in' && !(to.size < view.size)) throw new Error(shot.id + ' push-in must get tighter');
    if (shot.type === 'pull-out' && !(to.size > view.size)) throw new Error(shot.id + ' pull-out must get wider');
    tween = {shot, from: {...view}, to, frame: 0};
    cameraMode = 'tween';
    follow = null;
    phase = 'shot';
  }

  function beforeRender(feet) {
    let still = null;
    if (cameraMode === 'tween' && tween) {
      const span = tween.shot.frames;
      const t = span <= 1 ? 1 : tween.frame / (span - 1);
      view = clampView(lerpView(tween.from, tween.to, t), room);
      const last = tween.frame >= span - 1;
      if (last && tween.shot.still) {
        still = tween.shot.still;
        stills.push(still);
      }
      tween.frame += 1;
      if (tween.frame >= span) {
        cameraMode = 'fixed';
        tween = null;
        phase = 'route';
      }
      return {view, still};
    }
    if (cameraMode === 'follow' && follow) {
      const target = followTarget(feet, follow.size, room, follow.bias);
      view = stepFollow(view, target);
      return {view, still: null};
    }
    return {view, still: null};
  }

  function afterRender(api, frame) {
    if (phase === 'shot') return;
    if (phase === 'hold') {
      holdLeft -= 1;
      if (holdLeft > 0) return;
      phase = 'route';
    }
    if (phase === 'walk') {
      if (api.state() !== 'explore') throw new Error('walk while ' + api.state() + ' toward ' + walkTo);
      const position = api.position();
      if (Math.hypot(walkTo[0] - position.x, walkTo[1] - position.y) <= 0.5) {
        phase = 'route';
        stuck = 0;
      } else {
        if (position.x === lastX && position.y === lastY) stuck += 1;
        else stuck = 0;
        lastX = position.x;
        lastY = position.y;
        if (stuck > 90) throw new Error('stuck walking to ' + walkTo + ' at ' + position.x + ',' + position.y);
        if (!api.face(walkTo[0], walkTo[1])) throw new Error('no step toward ' + walkTo);
        return;
      }
    }
    if (phase === 'wait') {
      if (wait.skip) return;
      if (matches(api, wait)) phase = 'route';
      else {
        wait.left -= 1;
        if (wait.left <= 0) throw new Error('timeout ' + (wait.until || wait.button) + ' in ' + api.state());
        return;
      }
    }
    while (phase === 'route' && index < script.route.length) {
      const step = script.route[index];
      index += 1;
      if (step.do === 'shot') {
        startShot(shots[step.id], frame);
        if (phase === 'shot') return;
        continue;
      }
      if (step.do === 'hold') {
        holdLeft = step.frames;
        phase = 'hold';
        return;
      }
      if (step.do === 'walk') {
        walkTo = step.to;
        lastX = null;
        lastY = null;
        stuck = 0;
        phase = 'walk';
        const position = api.position();
        if (Math.hypot(walkTo[0] - position.x, walkTo[1] - position.y) <= 0.5) {
          phase = 'route';
          continue;
        }
        if (api.state() !== 'explore') throw new Error('walk while ' + api.state());
        if (!api.face(walkTo[0], walkTo[1])) throw new Error('no step toward ' + walkTo);
        return;
      }
      if (step.do === 'wait') {
        wait = {until: step.until || null, button: step.button || null, left: step.frames || 1, skip: !!step.skip};
        polls = 0;
        phase = 'wait';
        if (wait.skip) return;
        if (matches(api, wait)) {
          phase = 'route';
          continue;
        }
        return;
      }
      if (step.do === 'dismiss') {
        if (!api.dismiss()) throw new Error('dismiss failed');
        return;
      }
      if (step.do === 'choose') {
        if (!api.choose(step.label)) throw new Error('no choice ' + step.label + ' [' + api.buttons().join(' | ') + ']');
        return;
      }
      if (step.do === 'interact' || step.do === 'pickup') {
        if (api.state() !== 'explore') throw new Error(step.do + ' while ' + api.state());
        if (!api.focus(step.focus)) throw new Error('cannot focus ' + step.focus + ' at ' + JSON.stringify(api.position()));
        api.interact();
        return;
      }
      if (step.do === 'manual') {
        api.manual();
        return;
      }
      throw new Error('bad step ' + step.do);
    }
    if (phase === 'route' && index >= script.route.length) phase = 'done';
  }

  return {
    beforeRender,
    afterRender,
    takeWish() {
      const next = wish;
      wish = null;
      return next;
    },
    setWish(next) { wish = next; },
    poll(api) {
      if (phase !== 'wait' || !wait?.skip) return false;
      polls += 1;
      if (polls > 600) throw new Error('waited too long for ' + (wait.until || wait.button));
      if (!matches(api, wait)) return true;
      phase = 'route';
      polls = 0;
      return false;
    },
    waiting() { return phase === 'wait' ? wait : null; },
    get view() { return view; },
    get phase() { return phase; },
    get shotId() { return shotId; },
    get cameraMode() { return cameraMode; },
    get played() { return played; },
    get stills() { return stills; },
    get index() { return index; },
  };
}
