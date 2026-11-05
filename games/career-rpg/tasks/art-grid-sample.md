# Flash 严格网格小样任务

范围：美术设计阶段的原始像素数据小样，不实现游戏，不编辑或量化概念图。用原创逐格矩阵验证制作方式。最多10次工具调用、180秒。完成立即停，不循环扩写。

仅创建 art/grid-sample-v1/ 下的 source.json、generate.py、player.png、floor.png、preview.png、README.md。不能改其他文件；handoff由Codex记。只读本任务及 design/chapter-01-art.md 的配色、角色规格。

source.json 是唯一像素源：palette 为符号到精确RGBA的映射，`.`=透明；frames 是 down/up/left/right 四个24行、每行16个ASCII符号的像素矩阵，tile是16行每行16字符。不从概念图抽样，不加载外图，不用imagegen，不调用其他模型。原创代码原生素材，非既有图像编辑。人物黑发、朱砂红上衣、深裤、成熟简洁，四向可辨，左右单独绘制。角色每帧16x24，脚底索引[8,23]必须非透明，四向脚底在同一水平；除最底行脚底外保留合理透明边缘，禁止满框背景。用12色 #faf8f3 #292825 #77746e #a64335 #6b4a32 #a87c55 #8d8a83 #6f8f5a #5d6e7a #2f3a45 #e8dfc8 #e9c27a 加alpha0透明；其他alpha只能255。floor全不透明，木地板，仅少量连续板缝，别用噪点。

generate.py只用Python标准库（json,zlib,struct等），从source写RGBA PNG。player.png按down/up/left/right竖排为16x96；floor.png为16x16。preview.png把四向各自8倍近邻整数放大，并放一个8x8地砖铺地的缩小样板，预览背景用现有暖白；不画文字，由README注明排列与倍率。禁止插值/渐变/随机数/外部依赖。预览不可重叠，应包含角色站在地板上的效果，足够间隔。PNG使用每行filter0，输出可重复。

执行一次生成，README记录实际尺寸、源文件、命令、模型为deepseek-flash、技术自检结果；明确这是探索小样，视觉偏好和实机未验收，未获作者认可，不是生产素材。源矩阵不得编造剧情或真人外观。完成后简短汇报，不运行全仓verify。
