// Compatibility entry. The game loads one chapter module; tests can still import every chapter here.
export {OFFICE} from './chapters/nanjing.mjs';
export {HEFEI} from './chapters/hefei.mjs';
export {HANGZHOU} from './chapters/hangzhou.mjs';
export {transitionBeat,transitionFinished,presentCast,expressionFor,actionsFor,pendingMarkers,sceneTarget} from './chapters/logic.mjs';
