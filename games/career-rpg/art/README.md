# 首轮像素美术方向

## 当前制作路线（2026-11-05）

人物、表情和关键动作采用image_gen，实际输入南京对应参考；已有可用人物优先复用。程序负责可复用环境物件及裁切、锚点、图集排布和压缩，原图完整归档，视觉变化须对照复核。详细流程见[技术方案](../technical-plan.md)和[美术规范](./style-guide.md)。程序人物样品只作实验，不替代image_gen人物路线。

用户已授权先准备剩余场景缺失的人物图，按[全旅程人物清单](./character-roster.md)登记生成与复用；这项素材准备不代表场景通过或允许批量接入。以下内容保留为历史，不按旧“仅概念图”状态推进任务。

## 当前成品与合并结论（2026-11-05）

南京完整样章已接入 `../web/art/office-room-v2.png`、`player-walk-v1.png`、`npc-team-v1.png`、`player-emotions-v1.png`、`typing-team-v1.png`；人物设定为本目录的 `character-front-v1.png`、`character-four-directions-v1.png`。这些已实现素材共同构成用户本次指定基准，详见[美术规范](./style-guide.md)。本轮已通过 `view_image` 打开七张原图核对，未重画、未规整或修改原图。

下列段落与同名 review 是各轮当时的记录，“尚未四向”“尚无动画”等不再代表当前实现。旧 v1 概念板只辅助；grid-sample 曾被作者认为不好看，不作为正式造型。最新坐姿／气泡视觉、严格网格等未验结论继续保留，不以素材齐备冒充验收通过。

目标此前的 [NJ-CHAR-001](./requests/NJ-CHAR-001.json) 重复请求已标 `superseded`，指向现有四向与行走图，不再等待生成。[旧清单](./nanjing-scene-inventory.md)与 preflight 仅供追溯，不能作为制作进度。

## 以下为生成历史

## 严格网格小样

2026-11-04：[小样说明](./grid-sample-v1/README.md)、[预览](./grid-sample-v1/preview.png)、[自检](./grid-sample-v1/verification.json)与[独立抽验](./grid-sample-v1/codex-audit.json)。Flash 制作原始矩阵和导出流程，Codex 按用户授权接管人物可读性和精确配色检查。小样技术检查通过，作者尚未确认；未替代办公室概念板或生产素材验收。

2026-11-04，使用内置 imagegen 生成 [概念板 v1](./nanjing-art-direction-v1.png)，完整提示词见 [prompt-v1.txt](./prompt-v1.txt)。

本图是待审阅的概念参考，尚未获得用户对具体视觉的确认。主场景为南京办公室，辅以主角前／侧／背面、配色、道具、合肥宿舍、南京深夜与对话框。场所、服装和人物外貌均为设定，不还原真实办公室或本人外貌。

AI 视觉复核：方向、办公室动线、角色识别与中文对话可读；暖色日景和夜间书桌存在明确区别。图中带有纹理、细腻阴影及不统一的像素大小，不符合严格生产网格；仅给出一侧侧面，未提供完整四向动画。正式制作时需要规整素材、削减细节，并在实际渲染中确认像素清晰度。概念板不能直接作为图集切割使用。

下一次审阅聚焦：是否喜欢这一视角与人物比例，是否需要更粗颗粒的像素，整体是否过于温暖或可爱。确认方向后再做一组严格网格样品，暂不制作其他城市完整地图。

## v2 / v3 修订记录

2026-11-04：Flash 生成 [v2 提示词](./prompt-v2.txt)和[自检计划](./review-v2-plan.md)，Codex 使用内置 imagegen 生成 [v2](./nanjing-art-direction-v2.png)，再按 [v3 提示词](./prompt-v3.txt)编辑为 [v3](./nanjing-art-direction-v3.png)。未覆盖 v1。

[v2 自验](./review-v2.md)、[v3 自验](./review-v3.md)和[图片审计](./image-audit-v2-v3.json)已落盘。v3 轮廓更简洁，但仍有渐变与像素尺度问题，尚未通过 ART-01，不要求作者正式验收。

## 按样张重画正面角色

[正面角色 v1](./character-front-v1.png)参考办公室 v3 样张，内置 imagegen 生成；[完整提示词](./character-front-v1-imagegen-prompt.txt)与[审阅记录](./character-front-v1-review.md)已保存。本轮审阅造型，尚非生产图集。

## 四向角色与办公室道具

2026-11-04，Codex 使用内置 imagegen 完成 [四向角色](./character-four-directions-v1.png)和[办公室道具板](./office-props-v1.png)。完整提示词与审阅记录保存为同名 `-prompt.txt`、`-review.md`。造型一致性已复核，尚未制作生产图集或行走动画。
