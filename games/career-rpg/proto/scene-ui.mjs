export const BANNER_MS = 3000;

export function learningSkills(skills) {
  return skills.filter(skill => skill.id !== 'jquery');
}

// 同一时间只留最新一条。空文本清掉；到点后 bannerAt 返回空。
export function showBannerState(text, now, ms = BANNER_MS) {
  if (!text) return { text: '', hideAt: 0 };
  return { text, hideAt: now + ms };
}

export function bannerAt(state, now) {
  if (!state || !state.text || (state.hideAt && now >= state.hideAt)) return '';
  return state.text;
}

export function sceneArrival(kind, view) {
  if ((kind === 'computer' || kind === 'shelf') && !view.interviewed) {
    return { prompt: '先去找老板。' };
  }
  if (kind === 'computer') {
    if (view.night && view.dotaPending) return { dota: true };
    return { panel: true };
  }
  if (kind === 'shelf') {
    if (view.canStudy) return { action: { type: 'study', skill: 'jquery' } };
    return view.blocked ? { banner: view.blocked } : {};
  }
  if (kind === 'water') {
    return view.canRest ? { action: { type: 'rest' } } : {};
  }
  if (kind === 'door') {
    if (!view.night) return { action: { type: 'night' } };
    return view.canSleep ? { action: { type: 'sleep' } } : { banner: '行动点还没用完。' };
  }
  return {};
}

export function sceneHint(view) {
  const skill = (view.skills || []).find(item => item.blocked === '只能夜里学');
  return skill ? '只能夜里学' : '';
}
