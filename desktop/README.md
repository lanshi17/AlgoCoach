# 算法练习室桌面端

桌面壳采用 Electron，发布优先级为 macOS Apple Silicon（arm64）→ macOS Intel（x64）→ Linux x86_64。它复用 `frontend/` 的 React 工作区，启动时加载学习空间和编码练习；`/api`、`/animations` 通过本地服务转发到 Java Gateway。

## 开发

```bash
cd frontend && npm install && npm run build
cd ../desktop && npm ci && npm run dev
```

开发模式会自动启动 Vite（默认 `5177`）。如果 Gateway 未启动，桌面端仍能进入本地练习本；设置 `ALGOCOACH_GATEWAY_URL` 可改写 API 地址。

如果希望桌面端管理本地后端进程，可以设置 `ALGOCOACH_AUTOSTART_SERVICES=1`。它会在检测到 `backend/gateway/target/*.jar` 和 Agent 目录后启动自己拥有的 Gateway / Agent 子进程，退出应用时只回收自己启动的进程；数据库、知识库和索引位于应用的用户数据目录，不写入安装目录。未检测到构建产物时不会阻止离线练习。打包应用需要从源码目录启动服务时，再设置 `ALGOCOACH_SERVICE_ROOT=/path/to/AlgoCoach`。

## 打包

```bash
cd frontend && npm run build
cd ../backend/gateway && mvn -B -DskipTests package
cd ../../desktop && npm ci
npm run prepare:sidecar
npm run package:mac       # macOS Apple Silicon
npm run package:linux     # Linux x86_64
```

默认 `package:mac` 生成 Apple Silicon 包，Linux 默认生成 x86_64 包。Intel Mac 使用 `npm run package:mac:x64`。macOS 架构包应在对应的 macOS runner 上构建，Linux x86_64 包应在 Linux x86_64 runner 上构建。

Linux x86_64 产物包括 `AppImage` 和 `deb`，构建时会校验 Debian maintainer 元数据，并把前端静态资源嵌入安装包。

构建后可运行 `npm run verify:linux`，macOS runner 上对应运行 `npm run verify:mac:arm64` 或 `npm run verify:mac:x64`。

本地开发可运行 `npm run verify:runtime`，它会检查 SPA fallback、本地 API 代理和异常资源路径处理。源码环境中安装 Java 和 Agent 依赖并构建 Gateway 后，可运行 `npm run verify:services`，以临时目录和端口验证 Gateway 到 Agent 的连接以及数据库位置；`npm run verify:conversation` 使用本地模拟模型验证桌面代理到流式对话的链路。

桌面管理的服务使用应用用户数据目录；以前手动启动服务时保存在仓库 `data/` 的数据不会自动迁移。

默认打包命令会把 Gateway、Agent、Python 和 Java 侧车一起放入安装包；如果只需要前端薄壳，可使用 `package:mac:thin` 或 `package:linux:thin`，安装后需要另行启动后端。

## 侧车运行环境实验

在目标平台的构建机上安装 uv、Python 3.12 和 JDK，并构建 Gateway 后，运行 `npm run prepare:sidecar`。脚本使用带哈希的 `agent-requirements.lock` 创建独立 Python 环境，再将依赖、Python 运行时、jlink Java 运行时和后端代码写入 `sidecar-stage/`；Python 运行时中的构建机符号链接会被解引用，并断言侧车不指向构建目录之外。构建时会检查运行时和目标架构；默认打包入口会拒绝缺失或架构不匹配的侧车。移动此目录后，通过 `ALGOCOACH_SERVICE_ROOT=/绝对路径/sidecar-stage npm run verify:services` 验证启动。

准备侧车后，也可以直接运行 `npm run package:linux:sidecar` 或 `npm run package:mac:sidecar` 构建带侧车的包。Linux x86_64 的目录版、AppImage 解包运行和 deb 解包目录已验证启动、Python 样例运行和关闭后服务退出（`npm run verify:packaged-python`，需要 xvfb-run）；尚未验证 deb 实际安装或真实模型对话；macOS runner 会额外检查 arm64/universal 运行时，解压 zip 后启动其中的 Python / Java 运行时，并确认 Gateway JAR 与侧车路径完整。复习调度和本地练习记录保存在应用用户数据目录的浏览器存储中。发布前仍需在目标架构验证构建环境、依赖来源及完整运行。
