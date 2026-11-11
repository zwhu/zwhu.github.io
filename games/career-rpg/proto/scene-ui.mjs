export function learningSkills(skills) {
  return skills.filter(skill => skill.id !== 'jquery');
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
