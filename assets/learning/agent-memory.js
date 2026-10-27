/* Imported lesson interactions. */

(() => {
  const root = document.getElementById('am-walkthrough');
  const el = id => root.querySelector('#am-' + id);
  const steps = [
    {name:'接入', title:'首次会话：告诉 Agent 一个约束', from:'“旧鉴权还被移动端使用，先别重构。”', processor:'Agent → MemoryProxy → 上游模型', to:'当前会话中的回答', detail:'Proxy 位于 Agent 与模型之间，承担接入、身份处理和上下文注入。'},
    {name:'对话回流', title:'一轮结束：把对话交给记忆系统', from:'真实用户问题 + Agent 回答', processor:'MemoryProxy → MemoryCore', to:'L0 对话记录；Skill 对话归档', detail:'回流会过滤部分客户端附加噪声；是否写入与提取，受身份、能力开关和请求分类影响。'},
    {name:'分层提炼', title:'后台处理：把原话提炼成可复用记忆', from:'L0：“旧鉴权还被移动端使用……”', processor:'MemoryCore 的异步处理管线 + LLM', to:'L1 约束 → L2 鉴权场景 → L3 长期画像', detail:'这些是不同粒度的归纳；单句话不一定进入所有层，也不会立即生成全部层级。'},
    {name:'装配与授权', title:'切换 Agent：确定它能继承哪些资产', from:'自己的记忆 + 获准共享的资产', processor:'MemoryPanel 管理；MemoryCore 保存绑定并校验权限', to:'当前 Agent 可使用的记忆与工具入口', detail:'共享给团队与绑定给 Agent 是两个动作；private 资产只允许 Owner 访问。'},
    {name:'新会话召回', title:'新会话：“继续开发登录功能”', from:'当前问题 + 已有记忆', processor:'MemoryProxy 注入；Agent 按需查询', to:'L3 内容 + L2 目录；按需读取约束和知识', detail:'L2 全文、L1 细节与 Wiki / CodeGraph 按需取用；知识内容由 MemoryKnowledge 处理。'},
    {name:'带经验工作', title:'复用经验：约束再次进入模型上下文', from:'“继续开发登录” + “旧鉴权暂不可重构”', processor:'上游模型推理；Agent 执行任务', to:'结合已知约束制定方案，随后再次回流', detail:'这是外部记忆进入上下文的闭环；实际效果仍取决于提炼、召回结果和模型是否遵循。'}
  ];
  let index = 0;
  function render() {
    const s = steps[index];
    el('count').textContent = `${index + 1} / ${steps.length}`;
    for (const [target, key] of [['heading','title'],['from','from'],['processor','processor'],['to','to'],['detail','detail']]) el(target).textContent = s[key];
    el('prev').disabled = index === 0;
    el('next').disabled = index === steps.length - 1;
    el('next').textContent = index === steps.length - 1 ? '闭环已走完' : '下一步：' + steps[index + 1].name;
  }
  el('prev').addEventListener('click', () => { if(index > 0) { index--; render(); } });
  el('next').addEventListener('click', () => { if(index < steps.length - 1) { index++; render(); } });
  root.querySelectorAll('[data-topic]').forEach(button => button.addEventListener('click', () => {
    const topic = button.dataset.topic;
    root.querySelectorAll('[data-topic]').forEach(peer => peer.setAttribute('aria-expanded', String(peer === button)));
    root.querySelectorAll('[data-learning-panel]').forEach(panel => panel.hidden = panel.dataset.learningPanel !== topic);
    root.querySelector('[data-learning-panel="' + topic + '"]').scrollIntoView({block:'nearest'});
  }));
  root.querySelectorAll('[data-memory-answer]').forEach(button => button.addEventListener('click', () => {
    const correct = button.dataset.memoryAnswer === 'core';
    document.getElementById('memory-quiz-feedback').textContent = correct
      ? '✓ 正确。MemoryCore 负责记忆保存与异步提炼；MemoryProxy 负责接入、回流与上下文注入。'
      : '还差一点。接入和注入由 Proxy 承担；对原始对话做异步提炼的是 MemoryCore。';
  }));

  render();
})();

