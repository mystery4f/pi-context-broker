# 上下文发现与注入

用户在 prompt 中点名 Skill/Bundle 或匹配关键词规则，Context Broker 将上下文附加到当前会话；重复点名时不会追加第二份正文。

## Sub-features

- `inject-dollar`：中文/emoji 正文中连续两个 `$name` 都加载，第二次提交保持每个正文一份。
- `inject-rules`：默认 agentDir 下的 config/rules 生效，关键词加载第一项，后续 `$name` 加载第二项。
- `inject-discovery`：alias、Bundle 优先、namespace、显式 `bundle:` 规则由现有逻辑回归覆盖。
- `inject-persistence`：跨进程 `--continue` 保留已加载记录，单一持久会话。

## How to get to it (user POV)

- Pi 或 OMP 输入 `$design-context`；引用可紧接正文，多引用可出现在一条 prompt。
- 在 broker config 指定 roots/catalogs，通过 alias 或规则关键词请求上下文。
- 输入 `$bundle-name`，或命中配置中的显式 `bundle:<name>` 规则目标。
- 重新启动宿主时加 `--continue`，继续已保存会话。

## Driving it with control.mjs

Preconditions:

- Node.js 22+、Bun、Pi、OMP 可执行；`control.mjs doctor injection` ready。
- 配置、Skill 和模型 fixture 由 runner 创建，不读取用户的全局 broker 配置。

- **双宿主提交与续接。** 执行 `node .agents/skills/verify-context-broker/scripts/control.mjs run injection`。host runner 在两种 print 宿主提交 `中文😀先使用$design-context，再用$review-context。请一起评审`，自然退出，再带 `--continue` 提交相同内容。两次 provider 上下文中的两个 fixture marker 都分别恰好一份；decision 是一次合并注入、随后两条 already-loaded skip。
- **默认配置与规则。** 同一命令随后执行 global-config runner。先提交 `load first`，再继续并提交 `$second-context`；第一份正文两次都只有一份，第二份第一次为零、第二次为一。session 中恰好两个 broker custom message。
- **发现与 Bundle。** 执行 `bun run check` 覆盖 alias/ranking/Bundle index/规则类型/隐私边界。原生 Skill/Bundle 混合提交另走 [编辑器地图](editor.md)。逻辑回归通过不能声称 Pi/OMP 所有 Bundle 入口均已实际驱动。
- **证据。** manifest 指向 `context-broker-host-e2e-*` 与 `context-broker-config-e2e-*`：每个 host 下的 `provider-context.jsonl`、`decisions.jsonl`、`sessions/*.jsonl`。确认只有真实 `.jsonl` 被计入，锁文件不能当 session。结束后运行 `control.mjs evidence` 核对 transcript 和证据目录仍在。

## Gotchas

- 在 fixture HOME 中直接运行 Volta shim 可能递归。使用已有 harness 的真实入口解析，不取消 HOME 隔离。
- 已加载正文仍随有效会话发送；skip 不是 provider 中正文为零。
- `$` 自动补全与提交注入是两个入口，发现成功不证明注入成功。
- `/context-broker` diagnostics 是观察入口，host runner 没有实际驱动它的全部子命令；命令改动需单独驱动受影响命令并保存输出。
- Bundle 只提供成员索引；不能把成员 Skill 全文出现当成 Bundle 正常注入结果。
