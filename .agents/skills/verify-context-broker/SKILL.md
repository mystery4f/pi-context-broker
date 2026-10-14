---
name: verify-context-broker
description: "验证本项目 Context Broker 的 Pi/OMP 注入与会话生命周期、OMP/Tern 原生补全、真实模型效果及独立安装包。修改这些行为、升级宿主、验收发布产物或诊断运行差异时使用。"
---

# Verify Context Broker

面向首次接手本仓库的 agent。所有命令从仓库根目录执行；先读 [功能地图](features/README.md)，按改动选择功能，使用已有 harness 驱动真实宿主。Skill 和地图在 `.agents` 下维护，不修改全局 Skill 或用户的运行配置。

## Launch

```bash
bun install --frozen-lockfile
bun run build
```

构建成功应输出 `Built standalone broker query and Tern plugin query`，产物包括 `packages/context-broker/dist/completion.mjs` 与 `packages/tern-context-broker/query/completion.mjs`。依赖已安装且当前改动已构建时不重复安装或构建。构建会更新根 README/CONTRIBUTING/SECURITY/CHANGELOG 的 npm 分发投影，不把生成副本当成另一个文档来源；broker 双语参考在 `packages/context-broker/docs` 直接维护，Tern 双语指南随 GitHub 目录与归档分发。

本项目没有独立常驻服务器。CLI harness 每次创建临时 HOME、agentDir、sessionDir，加载仓库扩展，在 Pi/OMP 的 print 或 RPC 模式提交真实 prompt。启动器会在 HOME 隔离前解析 Volta 的真实入口，再用 Node 执行 Node CLI；不要把 HOME 改回用户目录来绕过启动问题。

原生 UI 由 `scripts/verify-native-ui.mjs` 启动独立 Tern daemon 和窗口，使用唯一 `control.sock`、`daemon.sock`、`TERN_CONFIG_DIR`、broker config 和 agentDir。就绪条件依次为自有 daemon socket、window control ready、`tern ctl ready` 的 shell prompt、`.sf-editor` 出现。该路径要求 macOS、Tern 0.8.3+、OMP 18.10.3+；它复用 OS 的 Tern 登录和进程 PATH，不能称为无凭据环境。只操作本次 control endpoint，不操作用户已有窗口。

真实模型路径使用已有 OMP 登录与模型配置，broker 配置和 session 放在临时目录。只调用 `magpie/group/flash-free`，不主动改用户模型或凭据；成功的实际响应才证明认证可用。

## Doctor

先执行与目标功能匹配的只读检查；任何异常先重跑 Doctor，再查该次证据：

```bash
node .agents/skills/verify-context-broker/scripts/control.mjs doctor editor
```

最后一个参数可为 `injection`、`editor`、`lifecycle`、`model`、`distribution`。Doctor 输出 Node 版本、实际 host executable/arguments、宿主版本、所需工具、平台以及 UI 构建产物 hash。要求 `status: ready` 和退出码 0。它只调用版本命令和读文件，不启动会话、不调用模型、不证明认证或功能成功。

CLI/RPC helpers 只用 Node.js 22+ 启动。CI 版本当前为 OMP 18.10.3、Pi 1.2.0、Bun 1.3.14；Doctor 记录本机实际版本，不能把本机通过当成另一版本或远端 CI 的通过。版本不同可做本机验证，但报告差异；宿主升级要重验对应路径。编辑器缺产物先 `bun run build`，缺宿主明确报告，不用别的入口冒充。

## Drive

```bash
node .agents/skills/verify-context-broker/scripts/control.mjs run editor
```

`run` 自动执行该功能的 Doctor，使用现有脚本，串行执行同一功能的所有命令，任一失败停止，并保留本次证据。不要每次都运行全部功能；按地图覆盖所有受本次改动影响的入口。

| 功能参数 | 实际执行 | 能证明什么 |
| --- | --- | --- |
| `injection` | 双宿主 host-e2e + global-config-e2e | 多引用注入、重复、关键词规则、默认 agentDir 配置与持久续接 |
| `editor` | verify-native-ui | 自动胶囊、删除/撤销、Skill/Bundle 混合提交与重复、手动 Unicode 替换/取消/焦点变化 |
| `lifecycle` | lifecycle-e2e | 同进程、fork、回退、续接、压缩保留/移除正文与仅标记摘要、XML 示例后首次加载 |
| `model` | verify-real-model | Skill 指令效果、真实默认摘要器、压缩后再次注入、实际请求 model selector |
| `distribution` | verify-artifacts + release.test | 安装后运行、独立查询程序与 Luau 依赖完整性、发布检查阻止 commit/tag/push |

`model` 发起真实网络请求；只在当前任务需要且已有授权覆盖此模型时执行。无授权或登录缺失时完成其余可达路径并记录未运行。`distribution` 的生产依赖安装需要 npm 网络；发布行为只在测试创建的临时 Git 仓库运行。

扩展改动的代码检查仍用 `bun run check`，编译或单元测试不能代替上述宿主/界面路径。修改 OMP 扩展后使用 `/restart`；`/reload-plugins` 不重新执行已加载扩展。Tern companion 的修改使用 `tern plugin reload`，不能用它代替 OMP 重启。

## Evidence

每次 `run` 输出 `Verification evidence: <绝对目录>`。目录位于系统临时目录，名称以 `broker-verification-<功能>-` 开头，包含 `manifest.json` 和按命令分开的 stdout/stderr transcript。manifest 记录本次功能、Doctor 的实际版本/入口、每条命令、时间、退出码/信号、原始 runner 证据目录；只记录执行过的路径。既有脚本和它们的行为断言负责判定通过，助手不复制这些断言。

清理后执行下面的命令，把最后一个参数换成刚输出的真实绝对目录：

```text
node .agents/skills/verify-context-broker/scripts/control.mjs evidence <本次绝对目录>
```

要求 `status: preserved`。该检查证明命令完成且 transcript/证据目录仍存在，不代替人工阅读截图或核对 provider 内容。

证明标准：

- 对应用户入口 → 实际动作 → 可观察状态变化；不能只截最后一屏或只看 `inject` 日志。
- 补全出现、草稿接受 `$name`、broker 判断、provider 收到正文、模型执行指令分别证明不同环节。明确验到了哪一层。
- 去重计数检查实际 provider messages，正常应有一份正文；不能把会话包含旧正文误报为“重复注入”。
- 用户/助手/工具中的 XML 示例、摘要里的标记都不是正文加载证据。fork/回退/压缩按当前有效上下文判断。
- 确定性 provider 替代的是已有 provider 边界的外部服务。生命周期 fixture 控制摘要内容和保留边界，宿主压缩准备、branch、persist、conversion 仍真实运行；它不证明默认 LLM 摘要器。只有 `model` 的 `fromExtension: false` 和传输证据证明真实默认摘要路径。
- 原生 UI 保留 `shots/live/*.png` 和 `*.layout.json`，结合操作 transcript 与 `provider.jsonl` 判断；手动选择成功还必须证明没有新增 provider 请求。
- 真实模型只记录 selector、fixture canary 计数和状态；不记录请求 URL、header、token。不要把真实用户配置、会话或凭据拷进证据包。
- 独立安装应在解包目录运行；checkout 通过不证明归档完整。未运行 Pi 包安装不能由 OMP 安装结果代替。
- `--dry-run`/`--precheck` 不等于完全无副作用：当前 release 在输出计划前会 fetch/prune tags 和查询 npm。不要在用户工作树运行发布来证明测试；使用临时仓库的 release.test 观察 Git refs 和 push hook。

## Cleanup

原始 runner 在 `finally` 中结束自己启动的 RPC、窗口和 daemon。print 进程应自然退出；RPC 的 SIGTERM/SIGKILL 是行为完成后的主动 teardown，不能冒充自然成功退出。CLI 超时清理只作用于自建进程组。Tern runner 保存 `owned-processes.json`，只终止持有的 ChildProcess，等待退出后写 `cleanup.json`。

成功和失败均保留证据、session、截图与 scratch fixture。不要按进程名批量 kill，不驱动/关闭其他 endpoint，不在失败后 reset/clean 用户工作树。运行结束但发现自有进程仍在时，核对 `owned-processes.json` 的 PID、command、唯一 socket 后只处理该实例；PID 已复用时不能依据旧记录发送信号。

需要释放磁盘时，先确认 runner 已结束、证据已审阅，再移到经过验证的系统废纸篓。macOS 使用 `/usr/bin/trash <本次绝对目录>`；其他系统先确认回收站实现。禁止永久删除，禁止在 cleanup 删除证据。

## Helpers

唯一新增助手为可执行的 `scripts/control.mjs`，使用方式就是上述 `doctor`、`run`、`evidence`。它按自身路径定位仓库根目录，复用已有 Node runner。Doctor 不探测真实模型认证；run 不安装宿主、不发布、不改全局配置。脚本原始证据格式由对应功能地图说明。

维护时使用 `/maintain-verification-skill`，同时更新地图里的入口、命令和证明边界。UI selectors、宿主协议或脚本变化后，重跑受影响功能，确认清理后证据仍存在。
