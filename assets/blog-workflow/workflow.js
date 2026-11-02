// 流程步进、改稿卡片与判断题。关闭脚本时，页面按顺序完整展示三处内容。
(() => {
  const tabs = (container, items, label, onSelect) => {
    const list = document.createElement('div');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', label);
    const buttons = items.map((item, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = item.id + '-tab';
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', item.id);
      item.setAttribute('role', 'tabpanel');
      item.setAttribute('aria-labelledby', button.id);
      item.tabIndex = 0;
      button.addEventListener('click', () => onSelect(index));
      button.addEventListener('keydown', event => {
        const move = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: items.length - 1 }[event.key];
        if (move === undefined) return;
        event.preventDefault();
        const next = (move + items.length) % items.length;
        onSelect(next);
        buttons[next].focus();
      });
      list.append(button);
      return button;
    });
    container.prepend(list);
    return { list, buttons };
  };

  const select = (items, buttons, index) => items.forEach((item, i) => {
    item.classList.toggle('is-active', i === index);
    buttons[i].setAttribute('aria-selected', String(i === index));
    buttons[i].tabIndex = i === index ? 0 : -1;
  });

  // 第 05、07 步失败后回到的步骤，用虚线框提示。
  document.querySelectorAll('[data-flow]').forEach(flow => {
    const steps = [...flow.querySelectorAll('.flow-step')];
    const holder = flow.querySelector('.flow-steps');
    const { list, buttons } = tabs(holder.parentElement, steps, '流程步骤', index => show(index));
    list.className = 'flow-rail';
    flow.querySelector('.widget-question').after(list);
    buttons.forEach((button, i) => {
      button.innerHTML = `<span class="rail-no">${String(i + 1).padStart(2, '0')}</span><span class="rail-label">${steps[i].dataset.short}</span>`;
      if (steps[i].hasAttribute('data-review')) button.dataset.review = '';
    });
    const pager = document.createElement('div');
    pager.className = 'flow-pager';
    pager.innerHTML = '<button type="button" data-step="-1">← 上一步</button><button type="button" data-step="1">下一步 →</button>';
    holder.after(pager);
    let current = 0;
    const show = index => {
      current = index;
      select(steps, buttons, index);
      const targets = [...steps[index].querySelectorAll('.flow-goto')].map(a => a.getAttribute('href').slice(1));
      buttons.forEach((button, i) => button.classList.toggle('is-target', targets.includes(steps[i].id)));
      pager.children[0].disabled = index === 0;
      pager.children[1].disabled = index === steps.length - 1;
    };
    pager.addEventListener('click', event => {
      const delta = Number(event.target.dataset.step);
      if (delta) show(Math.min(steps.length - 1, Math.max(0, current + delta)));
    });
    flow.addEventListener('click', event => {
      const link = event.target.closest('.flow-goto');
      if (!link) return;
      event.preventDefault();
      const index = steps.findIndex(step => '#' + step.id === link.getAttribute('href'));
      show(index);
      buttons[index].focus();
    });
    flow.classList.add('flow-ready');
    const fromHash = steps.findIndex(step => '#' + step.id === location.hash);
    show(Math.max(0, fromHash));
  });

  document.querySelectorAll('[data-cards]').forEach(section => {
    const cards = [...section.querySelectorAll('.feedback-card')];
    const { list, buttons } = tabs(section, cards, '选择反馈', index => select(cards, buttons, index));
    list.className = 'feedback-tabs';
    buttons.forEach((button, i) => { button.textContent = cards[i].dataset.short; });
    section.classList.add('cards-ready');
    const open = hash => {
      const index = cards.findIndex(card => '#' + card.id === hash);
      if (index >= 0) select(cards, buttons, index);
      return index;
    };
    if (open(location.hash) < 0) select(cards, buttons, 0);
    // 正文表格里的 WF 链接切换到对应卡片，再滚动到卡片区。
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href^="#wf-"]');
      if (!link || section.contains(link) || open(link.getAttribute('href')) < 0) return;
      event.preventDefault();
      section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      buttons[cards.findIndex(card => card.classList.contains('is-active'))].focus({ preventScroll: true });
    });
  });

  document.querySelectorAll('[data-quiz]').forEach(quiz => {
    const items = [...quiz.querySelectorAll('li[data-answer]')];
    const labels = { yes: '能', part: '一部分', no: '不能' };
    const answered = new Map();
    const score = document.createElement('p');
    score.className = 'quiz-score';
    score.setAttribute('aria-live', 'polite');
    quiz.append(score);
    const update = () => {
      const right = [...answered.values()].filter(Boolean).length;
      score.textContent = answered.size ? `已答 ${answered.size} / ${items.length}，与记录规则一致 ${right} 题。` : `共 ${items.length} 题，选一个答案就会显示理由。`;
    };
    items.forEach((item, index) => {
      const choices = document.createElement('div');
      choices.className = 'quiz-choices';
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', `第 ${index + 1} 题的选项`);
      const result = document.createElement('p');
      result.className = 'quiz-result';
      result.setAttribute('aria-live', 'polite');
      Object.entries(labels).forEach(([value, text]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = text;
        button.setAttribute('aria-pressed', 'false');
        button.addEventListener('click', () => {
          choices.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
          const right = value === item.dataset.answer;
          answered.set(index, right);
          result.innerHTML = (right ? '和记录规则一致。' : '记录规则的判断不同。') + item.querySelector('details p').innerHTML;
          update();
        });
        choices.append(button);
      });
      item.querySelector('details').before(choices, result);
    });
    quiz.classList.add('quiz-ready');
    update();
  });
})();
