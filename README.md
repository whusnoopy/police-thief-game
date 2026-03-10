# police-thief-game

警察抓小偷地图编辑与棋盘游戏。

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

当前测试覆盖 `v2/legacy` 地图编码迁移、旧 `localStorage` 数据迁移、应用启动流程，以及瞬移、半步逃脱、半步抓捕等关键移动边界。

## Deploy

当前生产部署方式改为上传 `dist/` 内容，而不是直接上传源码：

```bash
scp -r dist/* public_svr:~/police/
```
