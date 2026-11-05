# 第一章设计任务：南京首次上线

执行模型：deepseek-official / deepseek-flash。这里的“第一章”指首个制作样章，不改变合肥→南京→杭州的人生时间线。

你是本章游戏设计者。根据随任务提供的项目规则、事实规格、验收方案和个人写作偏好，产出可以继续制作的完整设计。只做设计，不修改源码，不生成游戏实现，不访问网络、不调用工具、不请求额外权限。完整上下文已内联提供。原有概念板尚未通过美术自验，不假定已获作者认可。

## 设计要求

- 固定正交俯视、像素角色、小型 Three.js 场景，加自用简单引擎。输入、剧情、渲染分离，中文 UI 用 DOM。
- 玩家是当年的作者：论坛用户说无法登录→作者呆住→CTO 带大家排查→恢复→同事安慰→补测试和坑点注释→工作手册。两小时用叙事转场表达。
- 不编造真实根因、具体代码、排查突破线索或老板逐字原话。调查以共同查看用户反馈、确认影响、确认参与排查等真实范围内的行为推进。恢复通过叙事过渡，不把点按钮描述成修复了真实技术原因。
- 明确真实事实、演出设定、尚缺史实。不要把夜读说成事故直接导致。暂无准确年份，不显示编造日期。
- 可玩时间约 120～180 秒是设计预期，不是已实测结果。要有空间探索和主动互动，避免连续点“下一句”的简历播放器；不能用长等待、考试或失败惩罚制造敬畏。
- 至少 2 个可选观察物件，不阻塞主线；清楚区分主线和观察提示。玩家不需要知道 fibjs 或前端技术才能完成。
- 给出 24×16 的房间地图布局，地砖16px、角色16×24px为待实机确认的初始设计。给出障碍、出生点、NPC和交互位置，走道可达；使用整数格坐标，以左上(0,0)为原点。
- 给出四向角色、关键道具、办公室日景/短转场、对话/论坛/手册的美术生产清单、像素尺寸、锚点与验收要求。避免把概念图当图集；不要求本轮实际生成这些资产。
- 明确键盘/触控、对话期间锁定移动、失焦暂停、重进、刷新、跳过、重复触发、稳定存档点与完成条件。
- 设计文本写给实施者，保持具体、自然中文。小节需要覆盖目标、分镜、地图、逐状态交互、对白草稿、可选探索、UI、音效建议、存档、制作任务、风险、Agent先验/作者后验及图片/视频证据。

## 输出协议

最终只输出一个 JSON 对象，不加 Markdown 包围，不调用工具。字段固定为：
- design_markdown：完整中文设计稿字符串，建议1800～3000中文字。
- art_markdown：本章美术制作规格字符串，建议700～1200中文字。
- chapter：按下述结构给出可检查的设计数据，不是已实现运行代码。

chapter字段：
{
 "id":"nanjing-first-release", "title":"自拟章节标题", "targetSeconds":[120,180],
 "entry":"office", "terminal":"complete",
 "map":{"width":24,"height":16,"spawn":[整数,整数],"blockedTiles":[[x,y]],
   "objects":[{"id":"desk","tile":[x,y],"interactionTile":[x,y],"required":true或false,"description":"具体用途"}]},
 "actors":[{"id":"player","name":"我","tile":[x,y]},{"id":"cto","name":"CTO","tile":[x,y]}],
 "states":[{"id":"office","goal":"...","playerAction":"...","feedback":"...","checkpoint":true或false}],
 "transitions":[{"from":"office","event":"稳定英文事件ID","to":"report","requires":[],"effects":["稳定标记ID"]}],
 "dialogues":[{"id":"英文ID","state":"report","speaker":"player或cto或narrator或colleague","text":"具体对白","basis":"fact_paraphrase或staging"}],
 "assets":[{"id":"英文ID","kind":"sprite或tile或ui或audio","size":[宽,高],"description":"用途与制作说明"}],
 "blockedHistoricalDetails":["尚未确认的根因等，不阻塞不造假的叙事设计"]
}

states必须恰好包含office,report,incident,investigation,restored,learning,complete。所有非终态有通往complete的路径。transitions中的requires只能引用其他转移已经能建立的effects标记。不要生成无生产者的初始标记。blockedTiles中坐标无重复。出生点与每个interactionTile必须可通过四向移动互达；交互位置不能在障碍里。objects的tile可为障碍，但与interactionTile曼哈顿距离不超过1。演员占位不计永久障碍，说明运行时避让策略。所有ID唯一，中文对白不是逻辑键。

这次只提交设计草案，不宣称游戏可玩、美术通过、性能通过或作者验收通过。只在结尾JSON内写内容，不加“已完成验证”的虚假声明。
