# 斜视人物与动物

`police.webp`、`thief.webp`、`pig.webp`、`cow.webp` 均为 384×384 RGBA WebP，总计 100,556 字节。沿用 `experiments/storybook/assets/` 的原始形象，增加大视口和放大时的图片清晰度；没有重新生成画面。

可用 `node scripts/export-isometric-actors.mjs` 从原始 PNG 导出；需要另行安装 sharp，或将其模块目录作为首个参数。日常构建不需要导出工具及 sharp。

其他斜视主体使用 `src/ui/isometric/` 的 SVG 几何绘制。坐标、固定光源、朝向与比例见 [斜视素材约定](../../../docs/isometric-art.md)。俯视所需的 14 张原资源保留在 `src/assets/storybook/`。
