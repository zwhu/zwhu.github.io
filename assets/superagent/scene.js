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
