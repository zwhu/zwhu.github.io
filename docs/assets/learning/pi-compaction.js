/* Imported lesson interactions. */

    (() => {
      const root = document.getElementById('pi-compaction-explainer');
      if (!root) return;

      const steps = [
        { title: '1. 检查阈值', detail: '读取模型上下文窗口与最近一次有效 usage；当 contextTokens > contextWindow − reserveTokens 时触发。' },
        { title: '2. 寻找切点', detail: '从最新消息向前累计，保留约 keepRecentTokens。切点可以是 user、assistant、bash 或 custom，但不会落在 toolResult 上。' },
        { title: '3. 序列化旧历史', detail: '将旧消息转成 [User]、[Assistant]、[Tool result] 等纯文本标签；摘要输入中的长工具结果截到约 2,000 字符。' },
        { title: '4. LLM 生成摘要', detail: '模型输出 Goal、Constraints、Progress、Key Decisions、Next Steps、Critical Context，并继承上一次摘要和累计文件操作。' },
        { title: '5. 追加记录', detail: '写入 CompactionEntry(summary, firstKeptEntryId, tokensBefore, details)。这是追加，不是删除或改写旧 SessionEntry。' },
        { title: '6. 重建上下文', detail: '下一轮模型看到 system prompt + compaction summary + firstKeptEntryId 之后的近期原始消息。' }
      ];

      const scenarios = {
        normal: {
          current: 118400, context: 128000, reserve: 16384, kept: 20000, summary: 1800,
          input: `[Previous summary]\n用户正在重构支付模块……\n\n[User]\n把重试逻辑迁移到 PaymentRetryPolicy。\n\n[Assistant tool calls]\nread(path="src/payment/service.ts")\nedit(path="src/payment/retry-policy.ts", ...)\n\n[Tool result]\n测试失败：timeout 分支仍调用旧实现……`,
          output: `## Goal\n重构支付重试逻辑并保持行为兼容。\n\n## Progress\n### Done\n- [x] 新建 PaymentRetryPolicy\n### In Progress\n- [ ] 迁移 timeout 分支\n\n## Key Decisions\n- 策略对象不负责记录 usage。\n\n## Next Steps\n1. 修改 service.ts\n2. 运行 payment 测试\n\n<read-files>src/payment/service.ts</read-files>\n<modified-files>src/payment/retry-policy.ts</modified-files>`,
          note: '新增的 CompactionEntry 只决定下一次构造模型上下文时，哪些历史由摘要替代。'
        },
        split: {
          current: 124900, context: 128000, reserve: 16384, kept: 20000, summary: 2600,
          input: `[User — 同一轮开始]\n分析 600 个测试失败并逐一修复。\n\n[Assistant / tool calls — 本轮前缀]\nread(...); edit(...); bash("pnpm test")\n[Tool result]\n……大量输出……\n\n--- 切点 ---\n本轮后缀仍作为近期原文保留`,
          output: `## 历史摘要\n此前已经完成测试基础设施迁移。\n\n---\n\n**Turn Context (split turn):**\n## Original Request\n分析并修复 600 个测试失败。\n## Early Progress\n- 已归类 timeout 与 mock 两类问题。\n## Context for Suffix\n- 最近保留内容从第 87 个失败开始。`,
          note: '当单个 turn 本身超过 keepRecentTokens，会生成“历史摘要”和“本轮前缀摘要”，随后合并；本轮后缀仍保留原文。'
        },
        repeat: {
          current: 119700, context: 128000, reserve: 16384, kept: 20000, summary: 2100,
          input: `[Previous summary]\n第一次压缩留下的 Goal / Progress / Decisions……\n\n[Messages surviving previous compaction]\n最近完成了数据库迁移。\n\n[New messages]\n继续实现 Worker 恢复与测试。`,
          output: `## Goal\n完成 Worker 恢复闭环。\n\n## Progress\n### Done\n- [x] 数据库迁移\n- [x] SessionEntry 投影\n### In Progress\n- [ ] Worker JSONL 恢复测试\n\n## Key Decisions\n- 原始 entry 保持 append-only。\n\n## Critical Context\n- 合并了上一次摘要与随后产生的新工作。`,
          note: '再次压缩会带入 previousSummary，并从上次 firstKeptEntryId 边界继续滚动总结，避免丢掉上次保留下来的关键消息。'
        }
      };

      let step = 0;
      let scenarioKey = 'normal';
      const nodeXs = [18, 181, 344, 507, 670, 833];
      const nodeLabels = [
        ['阈值检查', 'shouldCompact'],
        ['确定切点', 'findCutPoint'],
        ['消息序列化', 'serializeConversation'],
        ['模型总结', 'generateSummary'],
        ['追加记录', 'CompactionEntry'],
        ['重建上下文', 'buildSessionContext']
      ];
      const nodes = root.querySelector('#pc-nodes');
      const arrows = root.querySelector('#pc-arrows');

      nodeLabels.forEach((labels, index) => {
        const x = nodeXs[index];
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('data-step-node', String(index));
        g.innerHTML = `<rect class="flow-node" x="${x}" y="44" width="149" height="78" rx="10"></rect><text x="${x + 74.5}" y="76" text-anchor="middle">${labels[0]}</text><text class="muted-label node-sub" x="${x + 74.5}" y="100" text-anchor="middle">${labels[1]}</text>`;
        nodes.appendChild(g);
        if (index < nodeLabels.length - 1) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          line.setAttribute('class', 'flow-arrow');
          line.setAttribute('data-step-arrow', String(index));
          line.setAttribute('d', `M ${x + 149} 83 L ${nodeXs[index + 1] - 9} 83`);
          line.setAttribute('marker-end', 'url(#pc-arrow)');
          arrows.appendChild(line);
        }
      });

      function formatTokens(value) {
        return new Intl.NumberFormat('zh-CN').format(value) + ' tokens';
      }

      function renderStep() {
        root.querySelectorAll('[data-step-node]').forEach((node, index) => {
          node.querySelector('.flow-node').classList.toggle('active', index === step);
        });
        root.querySelectorAll('[data-step-arrow]').forEach((arrow, index) => {
          arrow.classList.toggle('active', index < step);
        });
        root.querySelector('#pc-step-count').textContent = `${step + 1} / ${steps.length}`;
        root.querySelector('#pc-step-detail').innerHTML = `<strong>${steps[step].title}</strong><div>${steps[step].detail}</div>`;
        root.querySelector('#pc-prev').disabled = step === 0;
        root.querySelector('#pc-next').disabled = step === steps.length - 1;
      }

      function renderEntries(key) {
        const row = root.querySelector('#pc-entry-row');
        const types = key === 'split'
          ? ['usr', 'ass', 'tool', 'ass', 'tool', 'ass', 'tool', 'ass', 'tool', 'cmp']
          : key === 'repeat'
            ? ['cmp₁', 'usr', 'ass', 'tool', 'usr', 'ass', 'tool', 'ass', 'tool', 'cmp₂']
            : ['usr', 'ass', 'tool', 'usr', 'ass', 'tool', 'tool', 'ass', 'tool', 'cmp'];
        row.innerHTML = '';
        types.forEach((type, index) => {
          const item = document.createElement('div');
          const isCompaction = type.startsWith('cmp');
          const isKept = key === 'split' ? index >= 7 && index < 9 : index >= 4 && index < 9;
          item.className = `pc-entry text-small${isCompaction ? ' compaction' : isKept ? ' kept' : ' compacted'}`;
          item.textContent = type;
          item.setAttribute('aria-label', isCompaction ? 'compaction entry' : isKept ? `${type}，原文保留` : `${type}，由摘要替代`);
          row.appendChild(item);
        });
        const context = key === 'split'
          ? '<span class="text-muted">下一轮上下文：</span> <code>system</code> + <code>history summary</code> + <code>turn-prefix summary</code> + <code>本轮后缀原文</code>'
          : key === 'repeat'
            ? '<span class="text-muted">下一轮上下文：</span> <code>system</code> + <code>summary₂</code> + <code>firstKeptEntryId₂ 之后原文</code>'
            : '<span class="text-muted">下一轮上下文：</span> <code>system</code> + <code>summary</code> + <code>firstKeptEntryId 之后原文</code>';
        root.querySelector('#pc-session-context').innerHTML = context;
      }

      function renderScenario() {
        const data = scenarios[scenarioKey];
        const threshold = data.context - data.reserve;
        const excess = data.current - threshold;
        const old = Math.max(data.current - data.kept, 0);
        const totalBefore = data.current + data.reserve;
        const showAfter = step >= 4;
        const summaryAmount = showAfter ? data.summary : old;
        const denominator = showAfter ? data.summary + data.kept + data.reserve : totalBefore;

        root.querySelector('#pc-current').textContent = formatTokens(data.current);
        root.querySelector('#pc-threshold').textContent = formatTokens(threshold);
        root.querySelector('#pc-threshold-status').textContent = `超过阈值 ${new Intl.NumberFormat('zh-CN').format(excess)}`;
        root.querySelector('#pc-kept-value').textContent = '≈ ' + formatTokens(data.kept);
        root.querySelector('#pc-example-input code').textContent = data.input;
        root.querySelector('#pc-example-output code').textContent = data.output;
        root.querySelector('#pc-persistence-note').textContent = data.note;

        const oldEl = root.querySelector('#pc-old');
        const keptEl = root.querySelector('#pc-kept');
        const reserveEl = root.querySelector('#pc-reserve');
        oldEl.classList.toggle('pc-old', !showAfter);
        oldEl.classList.toggle('pc-summary', showAfter);
        oldEl.style.width = `${Math.max((summaryAmount / denominator) * 100, 8)}%`;
        keptEl.style.width = `${(data.kept / denominator) * 100}%`;
        reserveEl.style.width = `${(data.reserve / denominator) * 100}%`;
        oldEl.querySelector('span').textContent = showAfter ? `摘要 ${(data.summary / 1000).toFixed(1)}k` : `旧历史 ${(old / 1000).toFixed(1)}k`;
        keptEl.querySelector('span').textContent = `近期原文 ${(data.kept / 1000).toFixed(0)}k`;
        reserveEl.querySelector('span').textContent = `预留 ${(data.reserve / 1000).toFixed(1)}k`;
        root.querySelector('#pc-context-bar').setAttribute('aria-label', showAfter ? '压缩后：结构化摘要、近期原文和输出预留' : '压缩前：待摘要旧历史、近期原文和输出预留');
        renderEntries(scenarioKey);
      }

      root.querySelector('#pc-prev').addEventListener('click', () => {
        if (step > 0) step -= 1;
        renderStep();
        renderScenario();
      });
      root.querySelector('#pc-next').addEventListener('click', () => {
        if (step < steps.length - 1) step += 1;
        renderStep();
        renderScenario();
      });
      root.querySelectorAll('[data-scenario]').forEach((button) => {
        button.addEventListener('click', () => {
          scenarioKey = button.getAttribute('data-scenario');
          step = 0;
          root.querySelectorAll('[data-scenario]').forEach((peer) => {
            const selected = peer === button;
            peer.classList.toggle('btn-primary', selected);
            peer.setAttribute('aria-pressed', selected ? 'true' : 'false');
          });
          renderStep();
          renderScenario();
        });
      });

      renderStep();
      renderScenario();
    })();
  
