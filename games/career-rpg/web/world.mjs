// Nanjing is the default room for the older call sites. The engine itself takes a room.
import {OFFICE} from './chapters/nanjing.mjs';
import {blocked as blockedAt,move as moveAt,integrateWalk as integrateAt,nearbyAll as nearbyAllAt,nearby as nearbyAt,MOVE_SPEED as SPEED} from './engine/world.mjs';
export const MOVE_SPEED=SPEED;
export const WORLD=OFFICE;
export const OBSTACLES=OFFICE.obstacles;
export const COMPUTERS=OFFICE.objects;
const room=config=>config||OFFICE;
export function blocked(x,y,config){return blockedAt(x,y,room(config));}
export function move(position,dx,dy,seconds,config){return moveAt(position,dx,dy,seconds,room(config));}
export function integrateWalk(position,dx,dy,seconds,config,remainder=0){return integrateAt(position,dx,dy,seconds,room(config),remainder);}
export function nearbyAll(position,config){return nearbyAllAt(position,room(config));}
export function nearby(position,config){return nearbyAt(position,room(config));}
