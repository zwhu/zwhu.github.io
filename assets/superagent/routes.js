// A source-based teaching scene; this does not run the actual Router or an LLM.
document.querySelectorAll('[data-route-demo]').forEach(demo=>{
  const cases={
    followup:{message:'在原话题 A：“还要兼容旧版 Excel。”',path:'程序查到话题 A 的订阅，直接加入 Ticket-42 的输入，原 Worker 在后续步骤接收补充。',decision:'同一任务，追加输入',ticket:'Ticket-42',worker:'原 Worker',route:'direct'},
    reference:{message:'在话题 B：“PR #123 还要兼容旧版 Excel。”',path:'明确 PR 引用帮助 Router 关联原 Ticket-42；attach 新话题，之后的补充可按订阅投递。',decision:'关联旧任务，增加订阅',ticket:'Ticket-42',worker:'原 Worker',route:'router'},
    newtask:{message:'在话题 B：“增加 CSV 导入功能。”',path:'这是新目标；Router accept 新任务，建立新 Ticket 与 Worker。主题都叫 CSV，不足以复用旧任务。',decision:'新目标，新建任务',ticket:'新 Ticket',worker:'新 Worker',route:'router'},
  };
  demo.querySelectorAll('[data-route-case]').forEach(button=>button.addEventListener('click',()=>{
    const item=cases[button.dataset.routeCase];if(!item)return;
    demo.querySelectorAll('[data-route-case]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    demo.dataset.route=item.route;
    for(const field of ['message','path','decision','ticket','worker'])demo.querySelectorAll('[data-route-field="'+field+'"]').forEach(e=>e.textContent=item[field]);
  }));
});
