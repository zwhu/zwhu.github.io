# 第六轮监督反馈：修复自动检查捕获的两个遗漏

Codex独立检查：七个状态checkpoint=true、atomic-per-event和legalSnapshots已就绪，整体结构15个可达配置、375个可达地图格。检查器现增加针对真实问题的回归，11个测试通过，但当前设计检查失败：Incorrect inherited entry flags: complete。

1. states.complete.enterFlags、写快照表和complete恢复例子漏掉comfort_read。前面的T08已经产生该标记，后面的所有事件都用flags并集，不能丢掉。当前ENTER仅从紧邻入边requires/effects计算，仍漏掉祖先继承标记。请从真实可达配置或legalSnapshots推导每个状态的保证标记（各合法配置的交集），不要只看最后一条边。所有公开快照示例必须符合真实可达flags，包括comfort_read；T11 requires也可明确保留该标记。不要删enterFlags、legalSnapshots或改检查器来绕过。
2. interactionDirs全是down，但对象[9,3]在玩家交互位[9,4]上方，正确是up。采用对象tile减交互点interactionTile的方向向量，dy=-1为up，dy=+1为down，dx类推。当前地图所有交互点都在对象南面，应该是up。同步JSON根interactionDirs、物体表、正文站位描述和恢复时朝向。
3. investigation有T05依赖recheck_visited，因此不是“三项顺序任意”。统一写成“论坛反馈和排查记录可先后任意，影响确认要在排查记录之后”，核对分镜、JSON playerAction和状态说明，不能让说明与requires相反。

检查器变化由监督者负责，已有11个测试覆盖：继承标记、快照与图可达性、交互朝向。你只修改design/下的生成器与三份设计。先读新check-design.py报错，定点修复，然后实际运行生成器、check-design.py、tests/test_design.py与完整恢复模拟。保留数据原有功能，勿引入新玩法或兼容分支。

本轮只剩以上三点，修完用简短中文报告，全部游戏实现、画面和性能仍未验证。
