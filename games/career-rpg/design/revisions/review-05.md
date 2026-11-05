# 第五轮监督反馈：必须收敛成单一政策，不能只让模拟器通过

地图和主要史实已通过复核；只需收尾以下矛盾。你上一轮快照模拟虽然能跑通，但三文件说明不一致：
- 状态表report/incident仍checkpoint none，分镜写“不写快照”，后文却说磁盘是report+report_read；
- 说office初始快照唯一且flags为空，又写chapter_start回退会带report_read；
- 用office_reopen→resume_report兼容分支掩盖状态/flags混合，且转换未在主状态机表达。

为了避免继续添加复杂恢复分支，本轮明确采用唯一的最小政策（此要求覆盖旧稿/旧反馈的恢复方案）：
1. 七个逻辑状态入口都是稳定检查点，全部states.checkpoint=true。chapter_start保存office+空flags+出生格。任一被接受的事件（含同状态首次确认）先完成state变化、flags并集，再把完整快照一次写入；无效或重复事件不改逻辑进度。snapshot.state必须就是当下当前状态，不另存一个旧checkpoint状态。
2. 读档只恢复这同一个快照，重播当前状态的必要短演出。report刷新回report，incident刷新回incident，investigation任一确认后刷新保留对应flags，learning任一确认后同理，complete保持完成。
3. 不保留office携带report_read的恢复兼容分支。这种状态与flags不合法就按损坏存档处理，提供重新开始或本次不保存。第一版没有既有用户存档，不需要迁移旧设计的错误格式。删除resume_report、“接着处理”等为错误混合态增加的特殊通道，避免隐式状态转换。
4. 在JSON增加savePolicy字段，明确atomic-per-event、初始快照、accepted-event写入、exact-snapshot恢复、invalid处理；状态表、每个分镜、事件表、存档段、模拟器必须一致。不许同时有scene/none/per_event_then_on_leave等多套政策描述。
5. 用只读模拟从chapter_start走一条完整路径，每个事件后序列化/读回，继续到complete；覆盖两种补测试/注释顺序、任一排查确认组合以及重复事件，证明不会丢标记/倒退/卡关。输出真实模拟结果。测试脚本可存在design/revisions，不实现游戏。

另一个明确坐标错：美术规格说“格左上+(8,16)即索引15”，16和15不相等。统一脚底落点为格左上+(8,15)，即世界逻辑像素(16*x+8,16*y+15)；精灵内anchor仍[8,23]。在JSON/MD/美术规格里只留这一个公式，别写“高度16行”或其他含糊转换。核对家具锚点同一像素索引约定。

地图/交互动作的新方案无需再扩展。针对生成器：请避免在旧长段落末尾连续替换修补导致残留，只保留一份最终savePolicy数据，相关表格和段落从它生成。清除遗留的矛盾语句；不要改检查器/测试/规格/验收，不要写任何游戏实现。

修改后实际执行check-design.py和tests/test_design.py；最后用简短中文汇报。Codex会独立检查所有checkpoint和完整恢复路径；不能仅凭你的最终回复判通过。

## 监督者定位的实际bug，先修这一处
上一轮被监督者主动终止，原因是在生成器中反复修改T03/T07而没有修正ENTER推导。当前gen-chapter-01.py中_entries对每条跨状态转移只并入t["requires"]，未计入t["effects"]，所以ENTER[report]变为空，ENTER[investigation]缺incident_seen，ENTER[complete]缺manual_entry_written。进入状态的保证标记必须包含该转移产生的effects；先修推导算法，不要改正确的剧情转移来迎合错误的推导，也不要删除断言。请先查看当前源文件，修掉这处并重跑，然后完成上文原子快照与锚点收尾。
修改完检查新旧段落的一致性，避免末尾再追加一套定义覆盖旧定义。输出不能只说已修改，实际运行生成器、check-design.py、test_design.py与恢复模拟，确认三文件已更新。
