# police-thief-game

警察抓小偷地图编辑与棋盘游戏。

目标设备为 iPad mini 7 及更大的平板，常用 iPad Air 3，以及 1920×1080 或更大的电脑屏幕；不针对手机小屏幕优化。

开始游戏前会检查出生点出口、取钱与逃脱路线，以及多次抓捕需要的警察局。动物会定期回农场，避免永久堵路。浏览器存储失败时可以继续编辑，页面会提示尚未保存，并提供备份导出与重试保存。

## Development

```bash
npm install
npm run dev
```

开发服务器默认由 Vite 提供，适合本地模块化开发与热更新。

## Build

```bash
npm run build
```

构建产物输出到 `dist/`。

## Test

```bash
npm test
```

当前测试覆盖 `v3/v2/legacy` 地图编码迁移、旧 `localStorage` 无感升级、应用启动流程，以及瞬移、自动上车/回库、停车场下车、待回库队列、复杂路线、逃脱和抓捕等关键移动边界。

## Deploy

当前生产部署方式改为上传 `dist/` 内容，而不是直接上传源码：

```bash
scp -r dist/* public_svr:~/police/
```
