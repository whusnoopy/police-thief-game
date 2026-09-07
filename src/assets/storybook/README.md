# 正式游戏绘本素材

14 张 WebP 发布资源，长边 192 像素，保留透明通道；足够覆盖 60 像素棋盘格的 3 倍显示密度。总计 135,606 字节（约 132 KiB），由原图确定性缩放和编码，未重新生成画面。

原图与生成提示保存在 `experiments/storybook/assets/`。需要重新导出时，安装 sharp 后运行 `node scripts/export-storybook-assets.mjs`，或把已有 sharp 模块目录作为首个参数。日常开发和构建直接使用本目录文件，不需要 sharp。

素材通过 Vite 模块 URL 引用，构建后具有内容哈希，支持相对路径部署。连续地形由 `src/ui/board/terrainArt.js` 绘制，主体/功能标记由 `src/ui/board/storybookArt.js` 绘制，角色状态由 `src/ui/game/unitRenderer.js` 组合。原始 PNG 不进入正式构建。
