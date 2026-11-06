# player-walk-v2

主角走路循环帧（修成片「一顿一顿」：旧 3 帧把 idle 插进走路）。

## 画布与锚点
- 单帧逻辑尺寸：**28×44**（对齐 `walk-cadence-check.json` 展示高度 44）
- 脚底基线：**y=43**（0-index）·「美术建议，最终以工程定的为准」
- Alpha：仅 0 / 255
- ×4 预览：112×176

## 目录
- `frames/{down,up,left,right}/`
  - `idle.png` / `.webp` / `-x4.png` — **仅站立**用
  - `walk-01.png` … `walk-06.png`（及 webp / x4）— **走路循环**
- `sheets/player-walk-v2-sheet.png`：7 列 × 4 行（×4 另存）
- `preview/{dir}-walk-x4.gif`：只循环 walk-01…06（不含 idle）

## 图集行列
| 行 | 方向 | 朝向约定 |
| --- | --- | --- |
| 0 | down | 正面朝向观众，全程 front |
| 1 | up | 背面，全程无脸 |
| 2 | left | **全程严格侧身 profile**（鼻尖向左） |
| 3 | right | **全程严格侧身 profile**（鼻尖向右，独立绘制非镜像） |

列：`idle | walk-01 | walk-02 | walk-03 | walk-04 | walk-05 | walk-06`

## 推荐循环
- 站立：只显示 `idle`
- 走路：`walk-01 → 02 → 03 → 04 → 05 → 06 → 01…`（**不要**把 idle 插进走路）
- 相位：01/04 contact（迈步双腿分开）· 02/05 down/recoil · 03/06 passing（过渡，非并腿站立）

## 色盘
复用 `player-walk-v1` 角色色（未追加场景共享盘新色）：
`#231D1A` 发/轮廓 · `#F0C4A8` 肤 · `#803028` 衣 · `#F5F0E6` 领 · `#3C3F48` 裤 · 及邻近明暗阶。

## 不改范围
不改坐姿/打字帧、合肥/杭州/南京场景与背景。
