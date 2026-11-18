# 算法练习室桌面端

桌面壳采用 Electron，目标平台为 macOS（Apple Silicon / Intel）与 Linux。它复用 `frontend/` 的 React 工作区，启动时加载学习空间和编码练习；`/api`、`/animations` 通过本地服务转发到 Java Gateway。

## 开发

```bash
cd frontend && npm install && npm run build
cd ../desktop && npm install && npm run dev
```

开发模式会自动启动 Vite（默认 `5177`）。如果 Gateway 未启动，桌面端仍能进入本地练习本；设置 `ALGOCOACH_GATEWAY_URL` 可改写 API 地址。

## 打包

```bash
cd frontend && npm run build
cd ../desktop && npm install
npm run package:mac
npm run package:linux
```

打包只负责桌面窗口和前端资源。Gateway / Agent 仍是本地服务，后续可通过 Electron sidecar 或系统服务安装器捆绑，避免把用户代码交给远程执行环境。
