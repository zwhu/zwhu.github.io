/* Imported lesson interactions. */

const panels = [...document.querySelectorAll('.prompt details')];
const expand = document.getElementById('expand');
function syncExpand(){expand.textContent = panels.every(p=>p.open) ? '收起全部' : '展开全部';}
expand.addEventListener('click',()=>{const open=!panels.every(p=>p.open);panels.forEach(p=>p.open=open);syncExpand();});
panels.forEach(p=>p.addEventListener('toggle',syncExpand));
let toastTimer;
function notify(message){clearTimeout(toastTimer);document.getElementById('toast').textContent=message;toastTimer=setTimeout(()=>document.getElementById('toast').textContent='',3500);}
async function copyText(text){
  try{if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(text);return true;}}catch(e){}
  const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.cssText='position:fixed;left:-9999px;top:0';document.body.appendChild(field);field.select();
  let copied=false;try{copied=document.execCommand('copy');}catch(e){}field.remove();return copied;
}
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
 const pre=document.getElementById(button.dataset.copy);const copied=await copyText(pre.textContent);
 if(copied){notify('提示词已复制，请替换方括号中的输入。');button.textContent='已复制 ✓';setTimeout(()=>button.textContent='复制提示词',1800);}
 else{pre.closest('details').open=true;const range=document.createRange();range.selectNodeContents(pre);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);notify('浏览器未允许自动复制，已选中文字，请按 ⌘C 或 Ctrl+C。');}
}));
let printState=null;
window.addEventListener('beforeprint',()=>{if(printState===null){printState=panels.map(p=>p.open);panels.forEach(p=>p.open=true);}});
window.addEventListener('afterprint',()=>{if(printState){panels.forEach((p,i)=>p.open=printState[i]);printState=null;syncExpand();}});
document.getElementById('print').addEventListener('click',()=>window.print());

