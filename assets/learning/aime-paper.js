/* Both tab groups share selection, focus and panel labelling. */
// Keyboard contract: https://www.w3.org/WAI/ARIA/apg/patterns/tabs/

function setupTabs(tablist, panel, render) {
  const tabs = [...tablist.querySelectorAll('[role="tab"]')];
  function select(index) {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    panel.setAttribute('aria-labelledby', tabs[index].id);
    render(index);
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else return;
      event.preventDefault();
      select(next);
      tabs[next].focus();
    });
  });
  select(Math.max(0, tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true')));
  return select;
}

const mechanisms = [
  {num:'01',name:'动态规划器',en:'Dynamic Planner',problem:'静态计划在执行偏离、工具失败或环境变化后无法自我修正。',action:'每一轮同时更新全局任务树 Lₜ₊₁，并决定下一步可执行动作 gₜ₊₁。',output:'把“先计划、后等待”变成持续观察、持续重规划。'},
  {num:'02',name:'角色工厂',en:'Actor Factory',problem:'预设角色和工具集很难覆盖执行过程中突然出现的新任务。',action:'根据子任务按需组合 Persona、工具包、知识、环境约束与输出格式。',output:'每个 Actor 都是为当前任务临时装配的专门执行者。'},
  {num:'03',name:'动态执行者',en:'Dynamic Actor',problem:'复杂子任务需要局部自治，中央规划器不应控制每一次工具调用。',action:'使用 ReAct 循环在本地历史 Hₖ 上推理、行动、观察，并主动报告里程碑。',output:'子任务结束时返回状态、总结与文件 / URL 等引用指针。'},
  {num:'04',name:'进度管理',en:'Progress Management',problem:'Agent 之间直接传话容易丢上下文，也会造成重复工作和状态分叉。',action:'用全局层级任务列表作为单一事实源，接收实时更新与最终结论。',output:'所有组件共享同一任务状态、依赖、完成标准和成果索引。'}
];
const results = [
  {aime:77.6,baseline:71.5,baseName:'Langfun',unit:'成功率'},
  {aime:66.4,baseline:65.8,baseName:'OpenHands',unit:'解决率'},
  {aime:92.3,baseline:89.1,baseName:'Browser use',unit:'成功率'}
];
const detail = document.querySelector('.mechanism-detail');
const setMechanism = setupTabs(document.querySelector('.mechanism-tabs'), detail, index => {
  const item=mechanisms[index];
  detail.querySelector('.detail-top p').textContent=item.en;
  detail.querySelector('h3').textContent=item.name;
  const dds=detail.querySelectorAll('dd'); dds[0].textContent=item.problem; dds[1].textContent=item.action; dds[2].textContent=item.output;
});
document.querySelectorAll('.satellite').forEach((button, index) => button.addEventListener('click', () => {
  setMechanism(index);
  document.getElementById('aime-module-' + index).focus({preventScroll: true});
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelector('.architecture-shell').scrollIntoView({behavior: reduceMotion ? 'auto' : 'smooth', block: 'start'});
}));
const card = document.querySelector('.chart-card');
setupTabs(document.querySelector('.result-tabs'), card, index => {
  const item=results[index];
  card.querySelector('.score-main strong').textContent=item.aime;
  card.querySelector('.score-main small').textContent=item.unit;
  const rows=card.querySelectorAll('.bar-row');
  rows[0].querySelector('i').style.width=item.aime+'%'; rows[0].querySelector('b').textContent=item.aime+'%';
  rows[1].querySelector('label').textContent=item.baseName; rows[1].querySelector('i').style.width=item.baseline+'%'; rows[1].querySelector('b').textContent=item.baseline+'%';
  card.querySelector('.delta strong').textContent='+'+(item.aime-item.baseline).toFixed(1);
});

