# Random Picture API

一个部署在 Vercel 上的轻量随机图片重定向服务。服务启动时从随函数打包的
[`url.csv`](./url.csv) 读取图片地址，不会在请求期间通过 HTTP 回调自己，也没有
第三方运行时依赖。

## API

- `GET /api`：随机选择图片并返回 `302`。
- `GET /api?id=3`：返回指定编号的图片；无效或越界编号退回随机选择。
- `GET /api?json&id=3`：返回 `{ "id": 3, "url": "..." }`。
- `GET /3.jpg`：等价于 `/api?id=3`；同时支持 `jpeg/png/gif/bmp/webp` 后缀。
- `GET /api?raw`：固定返回 `403`，避免函数中转图片流量。

只有严格的十进制安全整数会被当作固定编号。固定编号响应缓存一天，随机响应不缓存。
列表缺失、为空或没有有效 HTTP(S) 地址时，服务返回不泄露内部路径的 `503`。

## 本地验证

需要 Node.js 20 或更高版本：

```sh
npm test
node --check api/index.mjs
```

## 部署

将仓库导入 Vercel，Framework Preset 选择 `Other`，其他构建设置保持默认即可。
`vercel.json` 会把根目录的 `url.csv` 打包进 Node.js Function。

## 来源与许可

图片列表迁移自 [`THU-Pieris/Random-Picture`](https://github.com/THU-Pieris/Random-Picture)。
本仓库的 API 实现已针对 Vercel Node.js Web Handler 重写，并使用仓库内的
[GNU GPL-3.0 许可证](./LICENSE)。图片版权归各自权利人所有，`url.csv` 仅保存外链。
