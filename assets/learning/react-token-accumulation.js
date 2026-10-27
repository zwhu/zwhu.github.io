/* Imported lesson interactions. */

const svg=document.querySelector('svg'),toggle=document.querySelector('#toggle');
toggle.onclick=()=>{if(svg.animationsPaused()){svg.unpauseAnimations();toggle.textContent='暂停'}else{svg.pauseAnimations();toggle.textContent='继续'}};
document.querySelector('#restart').onclick=()=>{svg.setCurrentTime(0);svg.unpauseAnimations();toggle.textContent='暂停'};
document.querySelector('#final').onclick=()=>{svg.setCurrentTime(16);svg.pauseAnimations();toggle.textContent='继续'};

if (matchMedia("(prefers-reduced-motion: reduce)").matches) document.getElementById("final").click();

