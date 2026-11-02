/*
Architecture Canvas adapted for zwhu.github.io.
MIT License

Copyright (c) 2026 Yulong He

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Generated scene is inserted by scripts/render-superagent-diagrams.cjs.
export function mountArchitecture(host, { shareView = false } = {}) {
  if (host.shadowRoot) return;
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `
<style>

  :host {
    display: block; position: relative; height: 100%; overflow: hidden;
    color-scheme: light; contain: layout paint;
    --bg: #faf8f3; --chrome: rgba(250,248,243,.96);
    --chrome-border: #e6e2da; --ink: #292825; --ink-mut: #77746e;
    --ink-dim: #77746e; --accent: #a64335;
    --hover: rgba(166,67,53,.07); --press: rgba(166,67,53,.12);
    --kbd-bg: rgba(15,23,42,.06); --hint-faded: .75;
    background: var(--bg); color: var(--ink);
    font: 12px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;
  }
  * { box-sizing: border-box; }
  #stage { position: absolute; inset: 0; }
  #c { display: block; width: 100%; height: 100%; cursor: grab; touch-action: none; }
  #c.panning { cursor: grabbing; }
  #c.pointing { cursor: pointer; }

  /* ---- floating chrome ---- */
  .bar {
    position: absolute; z-index: 10;
    display: flex; align-items: center; gap: 2px;
    padding: 5px;
    background: var(--chrome);
    border: 1px solid var(--chrome-border);
    border-radius: 4px;
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
  }
  #toolbar { bottom: 18px; left: 50%; transform: translateX(-50%); }
  button {
    appearance: none; border: 0; background: transparent;
    color: var(--ink-mut);
    font: inherit; font-size: 11px; font-weight: 500;
    height: 28px; min-width: 28px; padding: 0 9px;
    border-radius: 4px; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center;
    transition: background 120ms ease, color 120ms ease;
  }
  button:hover { background: var(--hover); color: var(--ink); }
  button:active { background: var(--press); }
  button svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
  .sep { width: 1px; height: 17px; background: var(--chrome-border); margin: 0 4px; flex: none; }
  #zoomLabel {
    font-size: 10.5px; color: var(--ink-dim); min-width: 46px;
    text-align: center; font-variant-numeric: tabular-nums; user-select: none;
  }

  /* ---- hint ---- */
  #hint {
    position: absolute; top: 18px; right: 18px; z-index: 10;
    font-size: 10.5px; color: var(--ink-dim); text-align: right;
    line-height: 1.75; pointer-events: none; user-select: none;
    transition: opacity 400ms ease;
  }
  #hint kbd {
    font: inherit; font-size: 10px; color: var(--ink-mut);
    border: 1px solid var(--chrome-border); border-radius: 4px;
    padding: 1px 4px; background: var(--kbd-bg);
  }
  #hint.faded { opacity: var(--hint-faded); }

  /* ---- focus readout ---- */
  #readout {
    position: absolute; bottom: 62px; left: 18px; z-index: 10;
    max-width: 320px; padding: 10px 13px;
    background: var(--chrome); border: 1px solid var(--chrome-border);
    border-radius: 4px; backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px);
    opacity: 0; transform: translateY(6px); pointer-events: none;
    transition: opacity 160ms ease, transform 160ms ease;
  }
  #readout.on { opacity: 1; transform: translateY(0); }
  #readout .p {
    display: flex; align-items: center; gap: 6px; margin-bottom: 6px;
    font-size: 9px; font-weight: 700; letter-spacing: 1.8px;
    text-transform: uppercase; color: var(--plane, #94A3B8);
  }
  #readout .p i { width: 7px; height: 7px; border-radius: 2px; background: currentColor; flex: none; }
  #readout .t { font-size: 12px; font-weight: 600; color: var(--ink); }
  #readout .d { font-size: 10.5px; color: var(--ink-dim); margin-top: 5px; line-height: 1.6; }
  #readout .d em { font-style: normal; color: var(--ink-mut); }

  @media (max-width: 720px) {
    #hint { display: none; }
    #readout { max-width: calc(100% - 36px); bottom: 60px; }
    #toolbar { bottom: 12px; }
  }
button:focus-visible,canvas:focus-visible{outline:2px solid var(--accent);outline-offset:-3px}
button{white-space:nowrap}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div id="stage"><canvas id="c" tabindex="0" aria-label="Super-agent 架构画布：缩放、拖动或点击节点查看关系。完整文字说明见文章。"></canvas></div>

<div id="hint">
  <div>拖动画布平移 · 双指缩放</div>
  <div>点击节点聚焦 &nbsp;·&nbsp; <kbd>0</kbd> 适应 &nbsp;·&nbsp; <kbd>esc</kbd> 清除</div>
</div>

<div id="readout" aria-live="polite">
  <div class="p"><i></i><span></span></div>
  <div class="t"></div>
  <div class="d"></div>
</div>

<div class="bar" id="toolbar">
  <button id="bOut" title="缩小（−）" aria-label="缩小">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6M8 11h6"/></svg>
  </button>
  <div id="zoomLabel">100%</div>
  <button id="bIn" title="放大（+）" aria-label="放大">
    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6M8 11h6M11 8v6"/></svg>
  </button>
  <div class="sep"></div>
  <button id="bFit" title="适应画布（0）">适应</button>
  <button id="bOne" title="原始大小（1）">1:1</button>
  <div class="sep"></div>
  <button id="bPng" title="导出 PNG" aria-label="导出 PNG">
    <svg viewBox="0 0 24 24"><path d="M12 3v12m0 0l-4.5-4.5M12 15l4.5-4.5M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"/></svg>
  </button>
</div>
`;


  // ==========================================================================
  // FIXED VISUAL LANGUAGE — palette and text styles shared by every diagram
  // produced with this template. Scene data below references C.* freely.
  // ==========================================================================

  const C = {
    bg:        '#0E1217',
    boxFill:   '#161B23',
    boxStroke: '#2A3240',
    bandFill:  'rgba(255,255,255,0.02)',
    line:      '#8B93A1',
    sky:       '#7DD3FC',
    rose:      '#FB7185',
    orange:    '#F6821F',
    slate:     '#94A3B8',
    ink:       '#E7EAEE',
    mut:       '#9AA4B2',
    dim:       '#6E7A88',
    plane:     '#5B6673',
    arrowLbl:  '#98A2B0'
  };

  // ---- theme ---------------------------------------------------------------
  // Scenes bake `C.*` (and the odd literal hex) into their data at load time,
  // so the light theme is a paint-time remap rather than a second palette:
  // every colour the renderer is about to use goes through `col()` first.
  const LIGHT = {
    '#0e1217': '#faf8f3',                                // bg
    '#161b23': '#faf8f3',                                // boxFill
    '#2a3240': '#e6e2da',                                // boxStroke
    'rgba(255,255,255,0.02)': 'rgba(119,116,110,0.02)',    // bandFill
    '#8b93a1': '#77746e',                                // line
    '#7dd3fc': '#77746e',                                // sky
    '#fb7185': '#a64335',                                // rose
    '#f6821f': '#77746e',                                // orange
    '#94a3b8': '#77746e',                                // slate
    '#e7eaee': '#292825',                                // ink
    '#9aa4b2': '#77746e',                                // mut
    '#6e7a88': '#77746e',                                // dim
    '#5b6673': '#77746e',                                // plane labels
    '#98a2b0': '#77746e',                                // arrow labels
    // the rest of the recommended plane hues
    '#a78bfa': '#77746e', '#22d3ee': '#0891B2',
    '#4ade80': '#16A34A', '#fbbf24': '#B45309',
    // greys the scene recipe writes as literals
    '#3a4250': '#C8CDD6',                                // neutral band stroke
    '#4a5462': '#77746e'                                 // strapline separator
  };
  // Mapping a light value again returns it unchanged, so col() is idempotent.
  for (const v of Object.values(LIGHT)) LIGHT[v.toLowerCase()] = v;


  function col(c) {
    if (!c) return c;
    const k = String(c).toLowerCase();
    return k in LIGHT ? LIGHT[k] : (LIGHT[k] = darken(c));
  }

  // Fallback for scene hues outside the recommended list: pull anything too
  // pale for a light background down to a readable lightness, leave the rest
  // (and any non-hex value) alone.
  function darken(c) {
    const m = /^#([0-9a-f]{6})$/i.exec(c);
    if (!m) return c;
    const n = parseInt(m[1], 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum <= 0.5) return c;
    const f = 0.42 / lum;
    const h = (v) => Math.round(Math.min(255, v * f)).toString(16).padStart(2, '0');
    return '#' + h(r) + h(g) + h(b);
  }

  // Text styles, mirroring the <style> block in the SVG.
  const S = {
    title:  { size: 28,   weight: 700, fill: C.ink },
    sub:    { size: 14,   weight: 400, fill: C.mut },
    tag:    { size: 13,   weight: 400, fill: C.dim },
    hdr:    { size: 11,   weight: 700, ls: 2.5 },
    tagr:   { size: 10,   weight: 400, ls: 2 },
    plane:  { size: 9.5,  weight: 700, ls: 2, fill: C.plane },
    bl:     { size: 13.5, weight: 600, fill: C.ink },
    bs:     { size: 11,   weight: 400, fill: C.mut },
    bn:     { size: 10.5, weight: 400, fill: C.dim, italic: true },
    al:     { size: 10.5, weight: 400, fill: C.arrowLbl },
    legend: { size: 11,   weight: 400, fill: C.mut }
  };

  function planeColor(id) { return (PLANES[id] || { c: C.slate }).c; }

  // ======================== SCENE START (generated) =========================
const W = 1480, H = 1430;
const PLANES = {
  "input": {
    "c": "#94A3B8",
    "label": "事件来源"
  },
  "intake": {
    "c": "#7DD3FC",
    "label": "事件接收"
  },
  "routing": {
    "c": "#FB7185",
    "label": "任务路由"
  },
  "execution": {
    "c": "#F6821F",
    "label": "执行与交付"
  },
  "state": {
    "c": "#A78BFA",
    "label": "持久状态"
  }
};
const BANDS = [
  {
    "id": "band-input",
    "plane": "input",
    "x": 160,
    "y": 200,
    "w": 1260,
    "h": 160,
    "alpha": 0.45,
    "dash": false,
    "hdr": {
      "x": 184,
      "y": 230,
      "t": "事件来源"
    }
  },
  {
    "id": "band-intake",
    "plane": "intake",
    "x": 160,
    "y": 430,
    "w": 1260,
    "h": 160,
    "alpha": 0.45,
    "dash": false,
    "hdr": {
      "x": 184,
      "y": 460,
      "t": "接收与归属"
    }
  },
  {
    "id": "band-routing",
    "plane": "routing",
    "x": 160,
    "y": 660,
    "w": 1260,
    "h": 160,
    "alpha": 0.45,
    "dash": false,
    "hdr": {
      "x": 184,
      "y": 690,
      "t": "需要判断时调用 Router"
    }
  },
  {
    "id": "band-execution",
    "plane": "execution",
    "x": 160,
    "y": 890,
    "w": 1260,
    "h": 160,
    "alpha": 0.45,
    "dash": false,
    "hdr": {
      "x": 184,
      "y": 920,
      "t": "执行与交付"
    }
  },
  {
    "id": "band-state",
    "plane": "state",
    "x": 160,
    "y": 1120,
    "w": 1260,
    "h": 160,
    "alpha": 0.45,
    "dash": false,
    "hdr": {
      "x": 184,
      "y": 1150,
      "t": "本地持久状态"
    }
  }
];
const BOXES = [
  {
    "id": "feishu",
    "plane": "input",
    "band": "band-input",
    "x": 200,
    "y": 254,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "飞书讨论",
    "about": "飞书话题是 Thread；人类补充可以继续已有任务。",
    "texts": [
      [
        "bl",
        222,
        282,
        "飞书讨论"
      ],
      [
        "bs",
        222,
        308,
        "请求、补充与人类决定"
      ]
    ]
  },
  {
    "id": "github",
    "plane": "input",
    "band": "band-input",
    "x": 600,
    "y": 254,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "GitHub PR / Issue",
    "about": "绑定 PR 后的讨论可进入原 Ticket；它不是全局文件冲突检测。",
    "texts": [
      [
        "bl",
        622,
        282,
        "GitHub PR / Issue"
      ],
      [
        "bs",
        622,
        308,
        "评审、评论与 PR 状态"
      ]
    ]
  },
  {
    "id": "ci",
    "plane": "input",
    "band": "band-input",
    "x": 1000,
    "y": 254,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "CI / 自动事件",
    "about": "自动反馈不授予新任务权限，也不会自动唤醒已结束任务。",
    "texts": [
      [
        "bl",
        1022,
        282,
        "CI / 自动事件"
      ],
      [
        "bs",
        1022,
        308,
        "检查失败与恢复"
      ]
    ]
  },
  {
    "id": "trigger",
    "plane": "intake",
    "band": "band-intake",
    "x": 200,
    "y": 484,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Trigger",
    "about": "输入按事件 ID 去重，不同消息表达同一目标仍可能产生重复任务。",
    "texts": [
      [
        "bl",
        222,
        512,
        "Trigger"
      ],
      [
        "bs",
        222,
        538,
        "事件 ID、来源与原文"
      ]
    ]
  },
  {
    "id": "intake",
    "plane": "intake",
    "band": "band-intake",
    "x": 600,
    "y": 484,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Intake",
    "about": "Intake 在事务里保存事件并查订阅；无需模型为已知归属重新转发。",
    "texts": [
      [
        "bl",
        622,
        512,
        "Intake"
      ],
      [
        "bs",
        622,
        538,
        "监听范围、保存与扇出"
      ]
    ]
  },
  {
    "id": "thread",
    "plane": "intake",
    "band": "band-intake",
    "x": 1000,
    "y": 484,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Thread 订阅",
    "about": "多对多订阅决定后续投递路径；参考订阅不拥有任务也不恢复结束任务。",
    "texts": [
      [
        "bl",
        1022,
        512,
        "Thread 订阅"
      ],
      [
        "bs",
        1022,
        538,
        "讨论 → Ticket 的关联"
      ]
    ]
  },
  {
    "id": "candidate",
    "plane": "routing",
    "band": "band-routing",
    "x": 200,
    "y": 714,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Candidate / Eval",
    "about": "同一 Thread 的积压事件合批；Eval ID 与策略版本用于检查失效结果。",
    "texts": [
      [
        "bl",
        222,
        742,
        "Candidate / Eval"
      ],
      [
        "bs",
        222,
        768,
        "摘要、引用与待判断事件"
      ]
    ]
  },
  {
    "id": "router",
    "plane": "routing",
    "band": "band-routing",
    "x": 600,
    "y": 714,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Router 主会话",
    "about": "模型判断明确的任务关系；同主题不足以把新请求接到旧 Ticket。",
    "texts": [
      [
        "bl",
        622,
        742,
        "Router 主会话"
      ],
      [
        "bs",
        622,
        768,
        "accept · attach · stop · ignore"
      ]
    ]
  },
  {
    "id": "read",
    "plane": "routing",
    "band": "band-routing",
    "x": 1000,
    "y": 714,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "按需读取",
    "about": "完整上下文按对象 ID 和分页读取；窗口只保留摘要与近期必要信息。",
    "texts": [
      [
        "bl",
        1022,
        742,
        "按需读取"
      ],
      [
        "bs",
        1022,
        768,
        "orchestrator_read / eval_read"
      ]
    ]
  },
  {
    "id": "executor",
    "plane": "execution",
    "band": "band-execution",
    "x": 200,
    "y": 944,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "DshExecutor",
    "about": "固定 worker-TicketID 会话；新 Assignment 可复用旧会话和目录。",
    "texts": [
      [
        "bl",
        222,
        972,
        "DshExecutor"
      ],
      [
        "bs",
        222,
        998,
        "启动、投递与执行槽位"
      ]
    ]
  },
  {
    "id": "worker",
    "plane": "execution",
    "band": "band-execution",
    "x": 600,
    "y": 944,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "Worker 会话",
    "about": "通过 steer 接收后续输入；范围外消息 handback 给 Router。",
    "texts": [
      [
        "bl",
        622,
        972,
        "Worker 会话"
      ],
      [
        "bs",
        622,
        998,
        "调查、实现与验证"
      ]
    ]
  },
  {
    "id": "result",
    "plane": "execution",
    "band": "band-execution",
    "x": 1000,
    "y": 944,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "PR / 报告 / 回复",
    "about": "Worker 报告，Router 向原讨论回复；两个不同 PR 的逻辑冲突仍需处理。",
    "texts": [
      [
        "bl",
        1022,
        972,
        "PR / 报告 / 回复"
      ],
      [
        "bs",
        1022,
        998,
        "交付结果与待决定问题"
      ]
    ]
  },
  {
    "id": "ticket",
    "plane": "state",
    "band": "band-state",
    "x": 200,
    "y": 1174,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Ticket / Assignment",
    "about": "任务恢复建立新的 Assignment，并复查授权和当前代码/PR 状态。",
    "texts": [
      [
        "bl",
        222,
        1202,
        "Ticket / Assignment"
      ],
      [
        "bs",
        222,
        1228,
        "原请求、授权与执行记录"
      ]
    ]
  },
  {
    "id": "effects",
    "plane": "state",
    "band": "band-state",
    "x": 600,
    "y": 1174,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": true,
    "name": "Effects / Outbox",
    "about": "记录与动作意图一起提交；外部动作失败重试，以稳定 ID 防重复。",
    "texts": [
      [
        "bl",
        622,
        1202,
        "Effects / Outbox"
      ],
      [
        "bs",
        622,
        1228,
        "待执行动作与回执"
      ]
    ]
  },
  {
    "id": "sqlite",
    "plane": "state",
    "band": "band-state",
    "x": 1000,
    "y": 1174,
    "w": 380,
    "h": 82,
    "r": 5,
    "dash": false,
    "name": "SQLite + 状态目录锁",
    "about": "单机 Runtime 管理状态；没有跨 Router 副本的分布式一致性协议。",
    "texts": [
      [
        "bl",
        1022,
        1202,
        "SQLite + 状态目录锁"
      ],
      [
        "bs",
        1022,
        1228,
        "事务、WAL 与 FULL 同步"
      ]
    ]
  }
];
const EDGES = [
  {
    "from": "feishu",
    "to": "intake",
    "pts": [
      [
        390,
        336
      ],
      [
        390,
        396
      ],
      [
        790,
        396
      ],
      [
        790,
        478
      ]
    ]
  },
  {
    "from": "github",
    "to": "intake",
    "pts": [
      [
        790,
        336
      ],
      [
        790,
        396
      ],
      [
        790,
        478
      ]
    ]
  },
  {
    "from": "ci",
    "to": "intake",
    "pts": [
      [
        1190,
        336
      ],
      [
        1190,
        396
      ],
      [
        790,
        396
      ],
      [
        790,
        478
      ]
    ]
  },
  {
    "from": "intake",
    "to": "trigger",
    "pts": [
      [
        598,
        525
      ],
      [
        586,
        525
      ]
    ]
  },
  {
    "from": "intake",
    "to": "thread",
    "pts": [
      [
        982,
        525
      ],
      [
        994,
        525
      ]
    ]
  },
  {
    "from": "intake",
    "to": "candidate",
    "pts": [
      [
        630,
        568
      ],
      [
        630,
        615
      ],
      [
        390,
        615
      ],
      [
        390,
        708
      ]
    ],
    "label": {
      "s": "al",
      "x": 420,
      "y": 604,
      "t": "需要判断"
    }
  },
  {
    "from": "candidate",
    "to": "router",
    "pts": [
      [
        582,
        755
      ],
      [
        594,
        755
      ]
    ]
  },
  {
    "from": "router",
    "to": "read",
    "pts": [
      [
        982,
        755
      ],
      [
        994,
        755
      ]
    ]
  },
  {
    "from": "router",
    "to": "executor",
    "pts": [
      [
        790,
        798
      ],
      [
        790,
        846
      ],
      [
        390,
        846
      ],
      [
        390,
        938
      ]
    ],
    "label": {
      "s": "al",
      "x": 452,
      "y": 834,
      "t": "记录决定并分派"
    }
  },
  {
    "from": "executor",
    "to": "worker",
    "pts": [
      [
        582,
        985
      ],
      [
        594,
        985
      ]
    ]
  },
  {
    "from": "worker",
    "to": "result",
    "pts": [
      [
        982,
        985
      ],
      [
        994,
        985
      ]
    ]
  },
  {
    "from": "thread",
    "to": "worker",
    "pts": [
      [
        1382,
        525
      ],
      [
        1436,
        525
      ],
      [
        1436,
        864
      ],
      [
        940,
        864
      ],
      [
        940,
        938
      ]
    ],
    "label": {
      "s": "al",
      "x": 1452,
      "y": 700,
      "t": "已订阅事件直通",
      "rot": -90,
      "anchor": "center"
    }
  },
  {
    "from": "worker",
    "to": "router",
    "pts": [
      [
        790,
        938
      ],
      [
        790,
        808
      ]
    ],
    "label": {
      "s": "al",
      "x": 810,
      "y": 885,
      "t": "handback / 报告"
    }
  },
  {
    "from": "executor",
    "to": "ticket",
    "pts": [
      [
        390,
        1028
      ],
      [
        390,
        1168
      ]
    ]
  },
  {
    "from": "result",
    "to": "effects",
    "pts": [
      [
        1190,
        1028
      ],
      [
        1190,
        1090
      ],
      [
        790,
        1090
      ],
      [
        790,
        1168
      ]
    ]
  },
  {
    "from": "ticket",
    "to": "sqlite",
    "pts": [
      [
        580,
        1215
      ],
      [
        580,
        1298
      ],
      [
        1190,
        1298
      ],
      [
        1190,
        1250
      ]
    ]
  },
  {
    "from": "effects",
    "to": "sqlite",
    "pts": [
      [
        982,
        1215
      ],
      [
        994,
        1215
      ]
    ]
  },
  {
    "from": "effects",
    "to": "executor",
    "pts": [
      [
        198,
        1215
      ],
      [
        108,
        1215
      ],
      [
        108,
        985
      ],
      [
        194,
        985
      ]
    ],
    "label": {
      "s": "al",
      "x": 91,
      "y": 1105,
      "t": "提交后执行 / 重试",
      "rot": -90,
      "anchor": "center"
    }
  }
];
const TEXTS = [
  {
    "s": "title",
    "x": 160,
    "y": 86,
    "t": "Super-agent：事件、任务与持续执行"
  },
  {
    "s": "sub",
    "x": 160,
    "y": 118,
    "t": "读取摘要 → 判断归属 → 保存关系 → 执行与续办"
  },
  {
    "s": "tag",
    "x": 160,
    "y": 146,
    "t": "公开原型 6337fc8 · 实线：平台 / 基础设施 · 虚线：原型中的任务抽象"
  },
  {
    "s": "bn",
    "x": 160,
    "y": 1368,
    "t": "直通仍可能通知 Router；同一业务目标的重复请求和不同 PR 冲突未被自动解决。"
  },
  {
    "s": "bn",
    "x": 160,
    "y": 1392,
    "t": "本图为实现关系概览；箭头表示调用 / 关联，不表示所有操作存在一个跨系统事务。"
  }
];
const SWATCHES = [];
const CHIPS = [];

  // ========================= SCENE END ======================================

  // Index for fast lookup.
  const BOX_BY_ID = new Map(BOXES.map(b => [b.id, b]));

  // ==========================================================================
  // VIEW STATE
  // ==========================================================================

  const canvas = root.getElementById('c');
  // `ctx` is reassigned (not just mutated) during PNG export so the whole
  // render path can be reused against an offscreen surface — hence `let`.
  let ctx = canvas.getContext('2d');
  const readout = root.getElementById('readout');
  const zoomLabel = root.getElementById('zoomLabel');
  const hint = root.getElementById('hint');

  const view = { k: 1, x: 0, y: 0 };   // world → screen: p * k + (x, y)
  let vw = 0, vh = 0, dpr = 1;
  let hovered = null;                  // box id under the cursor
  let focused = null;                  // box id locked by a click
  let raf = 0;

  const MIN_K = 0.12, MAX_K = 4;

  function schedule() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; draw(); });
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    schedule();
  }

  function fitScale(pad) {
    return Math.min((vw - pad * 2) / W, (vh - pad * 2) / H);
  }

  function fit(animate) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) animate = false;
    const pad = vw < 720 ? 20 : 48;
    const k = clamp(fitScale(pad), MIN_K, MAX_K);
    goTo(k, (vw - W * k) / 2, (vh - H * k) / 2, animate);
  }

  function actualSize() {
    zoomAt(1, vw / 2, vh / 2, true);
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // Animated transitions for button-driven moves; instant for wheel/pinch/drag.
  let anim = null;
  function goTo(k, x, y, animate) {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) animate = false;
    if (!animate) { view.k = k; view.x = x; view.y = y; anim = null; schedule(); return; }
    anim = { from: { ...view }, to: { k, x, y }, t0: performance.now(), dur: 280 };
    step();
  }
  function step() {
    if (!anim) return;
    const p = Math.min(1, (performance.now() - anim.t0) / anim.dur);
    const e = 1 - Math.pow(1 - p, 3);
    view.k = anim.from.k + (anim.to.k - anim.from.k) * e;
    view.x = anim.from.x + (anim.to.x - anim.from.x) * e;
    view.y = anim.from.y + (anim.to.y - anim.from.y) * e;
    draw();
    if (p < 1) requestAnimationFrame(step); else anim = null;
  }

  function zoomAt(k1, sx, sy, animate) {
    k1 = clamp(k1, MIN_K, MAX_K);
    const wx = (sx - view.x) / view.k;
    const wy = (sy - view.y) / view.k;
    goTo(k1, sx - wx * k1, sy - wy * k1, animate);
  }

  // Reported relative to the diagram's native 1480×1940 size, so the 1:1
  // button and the readout agree.
  function syncZoom() {
    zoomLabel.textContent = Math.round(view.k * 100) + '%';
    writeHash();
  }

  // ---- shareable view state: #k,x,y --------------------------------------
  let hashTimer = 0;
  function writeHash() {
    if (!shareView) return;
    clearTimeout(hashTimer);
    hashTimer = setTimeout(() => {
      const h = '#' + [view.k.toFixed(3), Math.round(view.x), Math.round(view.y)].join(',');
      history.replaceState(null, '', h);
    }, 220);
  }

  function readHash() {
    if (!shareView) return false;
    const m = /^#([\d.]+),(-?\d+),(-?\d+)$/.exec(location.hash);
    if (!m) return false;
    const k = clamp(parseFloat(m[1]), MIN_K, MAX_K);
    if (!isFinite(k)) return false;
    view.k = k; view.x = +m[2]; view.y = +m[3];
    return true;
  }

  // ==========================================================================
  // DRAWING PRIMITIVES
  // ==========================================================================

  function font(st) {
    const italic = st.italic ? 'italic ' : '';
    return italic + st.weight + ' ' + st.size + "px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
  }

  function setText(st) {
    ctx.font = font(st);
    ctx.textBaseline = 'alphabetic';
    if ('letterSpacing' in ctx) ctx.letterSpacing = (st.ls || 0) + 'px';
    ctx.fillStyle = col(st.fill || C.mut);
  }

  function measure(st, t) {
    ctx.font = font(st);
    if ('letterSpacing' in ctx) ctx.letterSpacing = (st.ls || 0) + 'px';
    return ctx.measureText(t).width;
  }

  // Draws one text item; supports right/center anchoring and rotation, both of
  // which the source SVG uses for margin labels.
  function text(item, styleOverride) {
    // Precedence: base style < the item's own fill < caller override.
    const st = Object.assign({}, S[item.s], item.fill ? { fill: item.fill } : null, styleOverride);

    ctx.save();
    if (item.alpha != null) ctx.globalAlpha *= item.alpha;

    if (item.rot) {
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rot * Math.PI / 180);
      ctx.translate(-item.x, -item.y);
    }

    if (item.runs) {
      // Multi-colour single line (the header strapline with per-run colours).
      let x = item.x;
      for (const r of item.runs) {
        setText(Object.assign({}, st, { fill: r.fill }));
        ctx.fillText(r.t, x, item.y);
        x += measure(st, r.t);
      }
    } else {
      setText(st);
      let x = item.x;
      if (item.anchor === 'center') x -= measure(st, item.t) / 2;
      else if (item.anchor === 'right') x -= measure(st, item.t);
      ctx.fillText(item.t, x, item.y);
    }

    ctx.restore();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else {
      const rr = Math.min(r, w / 2, h / 2);
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y,     x + w, y + h, rr);
      ctx.arcTo(x + w, y + h, x,     y + h, rr);
      ctx.arcTo(x,     y + h, x,     y,     rr);
      ctx.arcTo(x,     y,     x + w, y,     rr);
      ctx.closePath();
    }
  }

  // Polyline with softened elbows — the one deliberate departure from the SVG,
  // which uses hard 90° corners. Reads better when the view is zoomed in.
  function polyline(pts, radius) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const [px, py] = pts[i - 1], [cx, cy] = pts[i], [nx, ny] = pts[i + 1];
      const d1 = Math.hypot(cx - px, cy - py);
      const d2 = Math.hypot(nx - cx, ny - cy);
      const r = Math.min(radius, d1 / 2, d2 / 2);
      ctx.lineTo(cx + (px - cx) / d1 * r, cy + (py - cy) / d1 * r);
      ctx.quadraticCurveTo(cx, cy, cx + (nx - cx) / d2 * r, cy + (ny - cy) / d2 * r);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  // Matches the SVG marker: 7.5 marker units at stroke-width 1.4 ≈ 10.5 world px.
  function arrowhead(from, to, color) {
    const a = Math.atan2(to[1] - from[1], to[0] - from[0]);
    const L = 9.5, Wd = 4.2;
    ctx.save();
    ctx.translate(to[0], to[1]);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-L, -Wd);
    ctx.lineTo(-L,  Wd);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  // ==========================================================================
  // FOCUS MODEL — what stays lit when a box is hovered or clicked
  // ==========================================================================

  function activeId() { return focused || hovered; }

  function relatedSet(id) {
    if (!id) return null;
    const box = BOX_BY_ID.get(id);
    const set = new Set([id]);
    if (box) set.add(box.band);           // edges that terminate on the band
    for (const e of EDGES) {
      if (e.from === id || e.to === id) { set.add(e.from); set.add(e.to); }
      else if (box && (e.from === box.band || e.to === box.band)) { set.add(e.from); set.add(e.to); }
    }
    return set;
  }

  // An edge is lit when it terminates on the active box, or on the band that
  // box sits in — several arrows in the source SVG target a band, not a box.
  function edgeLit(e) {
    const id = activeId();
    if (!id) return false;
    const band = (BOX_BY_ID.get(id) || {}).band;
    return e.from === id || e.to === id || e.from === band || e.to === band;
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = col(C.bg);
    ctx.fillRect(0, 0, vw, vh);

    drawGrid();

    ctx.save();
    ctx.translate(view.x, view.y);
    ctx.scale(view.k, view.k);
    renderScene(activeId());
    ctx.restore();

    syncZoom();
  }

  // Dot grid in screen space — a canvas affordance that makes panning legible.
  function drawGrid() {
    const spacing = 32 * view.k;
    if (spacing < 7) return;
    const alpha = clamp((spacing - 7) / 18, 0, 1);
    ctx.save();
    ctx.fillStyle = 'rgba(15,23,42,' + (0.10 * alpha).toFixed(4) + ')';
    const ox = view.x % spacing, oy = view.y % spacing;
    const r = view.k > 1.4 ? 1.15 : 1;
    for (let x = ox; x < vw + spacing; x += spacing) {
      for (let y = oy; y < vh + spacing; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function renderScene(active) {
    const set = relatedSet(active);
    const DIM = 0.16;

    // ---- bands
    for (const b of BANDS) {
      const lit = !set || set.has(b.id) ||
                  BOXES.some(x => x.band === b.id && set.has(x.id));
      const base = lit ? 1 : DIM;
      const hue = b.stroke || planeColor(b.plane);
      ctx.save();
      ctx.globalAlpha = base;

      roundRect(b.x, b.y, b.w, b.h, 14);
      ctx.fillStyle = col(C.bandFill);
      ctx.fill();

      ctx.globalAlpha = base * (b.alpha != null ? b.alpha : 1);
      ctx.strokeStyle = col(hue);
      ctx.lineWidth = 1.5;
      ctx.setLineDash(b.dash ? [6, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = base;

      if (b.hdr) text({ s: 'hdr', x: b.hdr.x, y: b.hdr.y, t: b.hdr.t, fill: b.hdr.fill || hue });
      if (b.tagr) text({ s: 'tagr', x: b.tagr.x, y: b.tagr.y, t: b.tagr.t, fill: b.tagr.fill || hue, anchor: 'right', alpha: b.tagr.alpha });
      ctx.restore();
    }

    // ---- free text & legend swatches
    ctx.save();
    ctx.globalAlpha = set ? 0.4 : 1;
    for (const t of TEXTS) text(t);
    for (const s of SWATCHES) {
      ctx.save();
      roundRect(s.x, s.y, s.w, s.h, 3);
      if (s.fill) { ctx.fillStyle = col(s.fill); ctx.fill(); }
      ctx.globalAlpha *= s.alpha;
      ctx.strokeStyle = col(s.stroke);
      ctx.lineWidth = 1.25;
      ctx.setLineDash(s.dash ? [6, 5] : []);
      ctx.stroke();
      ctx.restore();
    }
    for (const ch of CHIPS) {
      ctx.save();
      ctx.globalAlpha *= 0.85;
      roundRect(ch.x, ch.y, ch.w, ch.h, 2.5);
      ctx.fillStyle = col(ch.fill);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // ---- edges (under the boxes, as in the SVG). Their labels are deferred
    // to a pass after the boxes: several sit over a box edge, and the SVG
    // paints them on top.
    const deferredLabels = [];
    for (const e of EDGES) {
      const lit = !set || edgeLit(e);
      // A lit edge takes the hue of whichever plane the focused box lives in.
      const color = lit && set ? planeColor((BOX_BY_ID.get(active) || {}).plane) : C.line;
      ctx.save();
      ctx.globalAlpha = set ? (lit ? 1 : DIM * 0.7) : 1;
      ctx.strokeStyle = col(color);
      ctx.lineWidth = lit && set ? 1.9 : 1.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      polyline(e.pts, 9);
      const n = e.pts.length;
      arrowhead(e.pts[n - 2], e.pts[n - 1], col(color));
      ctx.restore();
      if (e.label) {
        deferredLabels.push({ label: e.label,
                              a: set ? (lit ? 1 : DIM * 0.7) : 1,
                              override: lit && set ? { fill: color } : null });
      }
    }

    // ---- boxes
    for (const b of BOXES) {
      const isActive = b.id === active;
      const lit = !set || set.has(b.id);
      const base = lit ? 1 : DIM;
      const hue = planeColor(b.plane);
      ctx.save();
      ctx.globalAlpha = base;

      if (isActive) {
        ctx.shadowColor = col(hue);
        ctx.shadowBlur = 24;
      }
      roundRect(b.x, b.y, b.w, b.h, b.r);
      ctx.fillStyle = col(C.boxFill);
      ctx.fill();
      ctx.shadowBlur = 0;

      // A whisper of the plane hue in the fill, so a column reads as a family
      // even before you look at the borders.
      ctx.globalAlpha = base * (isActive ? 0.13 : 0.05);
      ctx.fillStyle = col(hue);
      ctx.fill();

      // Solid (infra) boxes get the neutral border first, then a hue wash;
      // dashed (owned) boxes are drawn straight in the plane hue.
      ctx.lineWidth = isActive ? 1.9 : 1.25;
      if (!b.dash && !isActive) {
        ctx.globalAlpha = base;
        ctx.strokeStyle = col(C.boxStroke);
        ctx.stroke();
      }
      ctx.globalAlpha = base * (isActive ? 1 : b.dash ? 0.6 : 0.42);
      ctx.strokeStyle = col(hue);
      ctx.setLineDash(b.dash && !isActive ? [6, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = base;

      for (const [s, x, y, t] of b.texts) text({ s, x, y, t });
      ctx.restore();
    }

    // ---- edge labels, on top of everything
    for (const d of deferredLabels) {
      ctx.save();
      ctx.globalAlpha = d.a;
      text(Object.assign({}, d.label), d.override);
      ctx.restore();
    }
  }

  // ==========================================================================
  // HIT TESTING & INPUT
  // ==========================================================================

  function toWorld(sx, sy) {
    return [(sx - view.x) / view.k, (sy - view.y) / view.k];
  }

  function hitTest(sx, sy) {
    const [x, y] = toWorld(sx, sy);
    // Reverse order so the topmost box wins, matching paint order.
    for (let i = BOXES.length - 1; i >= 0; i--) {
      const b = BOXES[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b.id;
    }
    return null;
  }

  function showReadout(id) {
    const b = BOX_BY_ID.get(id);
    if (!b) { readout.classList.remove('on'); return; }
    const plane = PLANES[b.plane] || { c: C.slate, label: b.plane };
    readout.style.setProperty('--plane', col(plane.c));
    readout.style.borderColor = col(plane.c) + '55';
    readout.querySelector('.p span').textContent = plane.label;
    readout.querySelector('.t').textContent = b.name;
    readout.querySelector('.d').innerHTML = '<em>' + escapeHtml(b.about) + '</em>';
    readout.classList.add('on');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---- pointer
  let dragging = false, moved = false, lastX = 0, lastY = 0, downX = 0, downY = 0;
  const pointers = new Map();
  let pinchDist = 0, pinchK = 1;

  canvas.addEventListener('pointerdown', (e) => {
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a[0] - b[0], a[1] - b[1]);
      pinchK = view.k;
      dragging = false;
      return;
    }
    dragging = true; moved = false;
    lastX = downX = e.clientX;
    lastY = downY = e.clientY;
    canvas.classList.add('panning');
    hint.classList.add('faded');
  });

  canvas.addEventListener('pointermove', (e) => {
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);

    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinchDist > 0) {
        const r = canvas.getBoundingClientRect();
        zoomAt(pinchK * (d / pinchDist), (a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top, false);
      }
      return;
    }

    if (dragging) {
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      if (Math.abs(e.clientX - downX) + Math.abs(e.clientY - downY) > 4) moved = true;
      view.x += dx; view.y += dy;
      lastX = e.clientX; lastY = e.clientY;
      anim = null;
      schedule();
      return;
    }

    const r = canvas.getBoundingClientRect();
    const id = hitTest(e.clientX - r.left, e.clientY - r.top);
    canvas.classList.toggle('pointing', !!id);
    if (id !== hovered) {
      hovered = id;
      if (!focused) showReadout(id);
      schedule();
    }
  });

  function endPointer(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) { pinchDist = 0; }
    if (!dragging) return;
    dragging = false;
    canvas.classList.remove('panning');
    if (!moved) {
      const r = canvas.getBoundingClientRect();
      const id = hitTest(e.clientX - r.left, e.clientY - r.top);
      focused = (id && id === focused) ? null : id;
      showReadout(focused || hovered);
      schedule();
    }
  }
  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('pointerleave', () => {
    if (hovered && !focused) { hovered = null; readout.classList.remove('on'); schedule(); }
    else hovered = null;
  });

  let gestureK = 1, gestureActive = false;

  // macOS trackpad pinch is exposed by Chromium as a pixel-mode wheel event
  // with ctrlKey=true. Ordinary two-finger scrolling has no modifier and must
  // pan the canvas instead of changing scale. Line/page-mode Ctrl/Meta wheel is
  // left to the browser so its own page zoom remains available.
  canvas.addEventListener('wheel', (e) => {
    if (gestureActive) {
      e.preventDefault();
      return;
    }
    const trackpadPinch = e.ctrlKey && e.deltaMode === 0;
    if (trackpadPinch) {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      anim = null;
      zoomAt(view.k * Math.exp(-e.deltaY * 0.01), sx, sy, false);
    } else if (e.ctrlKey || e.metaKey) {
      return;
    } else {
      // Leave normal article scrolling available until the reader focuses the diagram.
      if (!shareView && root.activeElement !== canvas) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? Math.max(vw, vh) : 1;
      const rawX = e.deltaX * unit, rawY = e.deltaY * unit;
      const shiftWheel = e.shiftKey && Math.abs(rawX) < 1;
      view.x -= shiftWheel ? rawY : rawX;
      view.y -= shiftWheel ? 0 : rawY;
      anim = null;
      schedule();
    }
    hint.classList.add('faded');
  }, { passive: false });

  // Safari exposes trackpad pinch through GestureEvent rather than the
  // Chromium ctrl+wheel convention. Keep the initial scale stable for the
  // gesture and zoom around its on-canvas centre.
  canvas.addEventListener('gesturestart', (e) => {
    e.preventDefault();
    gestureActive = true;
    gestureK = view.k;
    anim = null;
    hint.classList.add('faded');
  }, { passive: false });
  canvas.addEventListener('gesturechange', (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = typeof e.clientX === 'number' ? e.clientX - r.left : vw / 2;
    const sy = typeof e.clientY === 'number' ? e.clientY - r.top : vh / 2;
    zoomAt(gestureK * e.scale, sx, sy, false);
  }, { passive: false });
  canvas.addEventListener('gestureend', (e) => {
    e.preventDefault();
    gestureActive = false;
  }, { passive: false });

  canvas.addEventListener('dblclick', (e) => {
    const r = canvas.getBoundingClientRect();
    zoomAt(view.k * 1.7, e.clientX - r.left, e.clientY - r.top, true);
  });

  // ---- keyboard
  root.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey) return;
    const pan = e.shiftKey ? 220 : 70;
    switch (e.key) {
      case '0': fit(true); break;
      case '1': actualSize(); break;
      case '+': case '=': zoomAt(view.k * 1.3, vw / 2, vh / 2, true); break;
      case '-': case '_': zoomAt(view.k / 1.3, vw / 2, vh / 2, true); break;
      case 'Escape':
        focused = null; readout.classList.remove('on'); schedule(); break;
      case 'ArrowLeft':  view.x += pan; schedule(); break;
      case 'ArrowRight': view.x -= pan; schedule(); break;
      case 'ArrowUp':    view.y += pan; schedule(); break;
      case 'ArrowDown':  view.y -= pan; schedule(); break;
      default: return;
    }
    e.preventDefault();
    hint.classList.add('faded');
  });

  // ---- toolbar
  root.getElementById('bIn').onclick  = () => zoomAt(view.k * 1.3, vw / 2, vh / 2, true);
  root.getElementById('bOut').onclick = () => zoomAt(view.k / 1.3, vw / 2, vh / 2, true);
  root.getElementById('bFit').onclick = () => fit(true);
  root.getElementById('bOne').onclick = () => actualSize();
  const pngButton = root.getElementById('bPng');
  pngButton.onclick = exportPng;

  // Renders the full diagram at 2× into an offscreen canvas, ignoring the
  // current pan/zoom and any focus state.
  function exportPng() {
    const scale = 2;
    const off = document.createElement('canvas');
    off.width = W * scale;
    off.height = H * scale;

    const live = ctx;
    ctx = off.getContext('2d');
    try {
      ctx.fillStyle = col(C.bg);
      ctx.fillRect(0, 0, off.width, off.height);
      ctx.scale(scale, scale);
      renderScene(null);
    } finally {
      ctx = live;
    }

    off.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'superagent-architecture@2x.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, 'image/png');
  }

  // ==========================================================================
  // BOOT
  // ==========================================================================

  resize();
  if (!readHash()) fit(false);
  schedule();
  // Observe the component rather than the whole browser viewport.
  new ResizeObserver(() => {
    if (!canvas.clientWidth || !canvas.clientHeight) return;
    resize();
    fit(false);
  }).observe(host);
  if (document.fonts) document.fonts.ready.then(schedule);
  setTimeout(() => hint.classList.add('faded'), 6000);
}
