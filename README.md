# Hodo

任务管理应用（Next.js）。

## 常用脚本

```bash
npm run dev          # 本地开发
npm run build        # 生产构建
npm run start        # 启动生产服务
npm run lint         # 代码检查
```

## 打包发布

### `npm run pack:serverjs`

用于构建**双重压缩**的传输包：

1. 先执行 Next.js standalone 部署打包，生成 `.tar.gz`（及对应 `.sha256`）
2. 再将该归档与校验文件打成外层 `.zip`

最终产物形如：

```text
hodo-nextjs-deploy-<timestamp>.tar.gz.zip
```

解压与启动示例：

```bash
unzip hodo-nextjs-deploy-*.tar.gz.zip
tar -xzf hodo-nextjs-deploy-*.tar.gz
cd hodo-nextjs-deploy-*
node server.js
```

如已有构建产物、仅想重新打传输包，可跳过重新 build：

```bash
SKIP_BUILD=1 npm run pack:serverjs
```

### 其它打包命令

| 命令 | 说明 |
|------|------|
| `npm run pack:deploy` | 仅生成 Next.js 部署 `.tar.gz` 包 |
| `npm run pack:double-zip` | 将源码（排除 `node_modules` 等）做成双重 zip |
