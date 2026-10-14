# Tern Context Broker

[English](./README.md) | [中文](./README.zh-CN.md) · [项目概览](https://github.com/yoyooyooo/pi-context-broker/blob/main/README.zh-CN.md)

[安装](#安装) · [使用](#使用) · [配置](#配置) · [开发](#本地开发)

可选的 Tern window 插件，用于从 OMP 草稿中搜索本地 Skill 和 Bundle。按 **Ctrl+Alt+Shift+K** 选择记录，再在准备好时提交补全后的 prompt。

OMP broker 提供自动 `$` 下拉和原生胶囊；这个配套插件增加手动搜索并编辑草稿，提交后的上下文加载由 broker 完成。

## 前提

- Tern 0.8.3+，提供原生 `session:surface`、`session:event` 和 `cx:pick` API。
- OMP 18.10.3+，已加载 Context Broker 扩展。
- Tern 的 PATH 中有 Node.js 22+，或显式配置 `node`。
- 本地 OMP pane；不支持远程 pane 和 Tern web client。

Broker 安装和配置见[项目快速开始](https://github.com/yoyooyooo/pi-context-broker/blob/main/README.zh-CN.md#快速开始)。GitHub `main` 的 broker 改动可能领先于 npm；该指南也说明如何加载当前 checkout。

## 安装

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
tern plugin list --json
```

已提交目录包含 `query/completion.mjs`、打包依赖和许可声明，安装无需 Bun 构建、npm 发版或依赖安装。`plugin list` 应显示 `context-broker` 的 `status: ready`，且没有 problems。安装会重载正在运行的 daemon；没有 daemon 时，下次启动生效。

更新复制安装时，重复安装并加上 `--force`：

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker --force
```

卸载使用 `tern plugin remove context-broker`。可选 release 归档也可以解包后使用 `tern plugin install <directory>` 安装。

## 使用

1. 聚焦本地 OMP pane，将光标放在 `$` 或 `$前缀` 后面，例如 `Review $des`。
2. 自动候选下拉可见时，先按 **Esc** 关闭；再按 **Ctrl+Alt+Shift+K** 打开手动搜索，筛选返回的候选并选择一条。
3. 检查草稿中已出现 `$design-review`。选择不会提交 prompt；取消不会改动草稿。
4. 准备好后提交，由已加载的 OMP broker 解析引用并注入上下文。

查询按 pane 的工作目录读取配置中的 Skill roots 和 catalogs，不继承 OMP 系统提示中动态发现的 Skill。默认快捷键冲突时，在 Tern 键盘设置中重绑 `plugin.context-broker.complete`。

## 双插件共存

Tern 呈现 OMP 的原生界面，OMP 仍执行自己的扩展和模型请求。Broker 和配套插件可以同时安装，职责如下：

| 安装组件 | 可用行为 |
| --- | --- |
| OMP broker | 自动 `$` 补全、原生胶囊和上下文注入 |
| Tern 配套插件 | 手动搜索与 `$name` 插入；broker 上下文注入需要 OMP 扩展 |
| 两者都安装 | Broker 的功能，加上 Tern 手动搜索弹框 |

配套插件仅在调用快捷键时编辑草稿，不提交 prompt 或注入上下文；注入和去重由 OMP broker 负责。手动搜索期间文本、光标或焦点变化，会取消过期操作。

自动下拉和手动弹框独立触发，目前没有显式互斥。先按 **Esc** 关闭自动下拉，再按 **Ctrl+Alt+Shift+K** 打开手动搜索。原生 UI 验收覆盖这条顺序，未覆盖两个菜单同时打开；可共存不代表同时打开菜单时一定没有交互冲突。

Tern 启动的 OMP 必须从当前 agent 目录或 profile 加载 broker；配套插件也应使用该 profile 的配置，见下一节。


## 配置

查询默认读取 `~/.omp/agent/context-broker/config.yml`，使用与 broker 相同的 roots 和 catalogs。完整发现配置见 [broker 参考](https://github.com/yoyooyooo/pi-context-broker/blob/main/packages/context-broker/docs/reference.zh-CN.md#配置)。

可选覆盖配置位于 `<Tern config>/plugin-data/context-broker/config.json`，独立于安装源码：

```json
{
  "node": "/absolute/path/to/node",
  "config": "/absolute/path/to/context-broker/config.yml",
  "agentDir": "/absolute/path/to/profile/agent"
}
```

所有字段可选；请换成实际安装和 profile 路径。使用命名 OMP profile 时，设置 `agentDir` 或 `config`，让查询与 broker 配置一致。macOS 默认 Tern config 目录为 `~/Library/Application Support/Tern`，`TERN_CONFIG_DIR` 可覆盖。更新插件源码会保留这份独立配置。

## 本地开发

在本地构建和 GitHub 版本间切换，使用复制安装即可。在仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run build
tern plugin install ./packages/tern-context-broker --force
omp -e ./packages/context-broker/src/index.ts
```

修改 TypeScript 查询后，重新构建并执行本地安装；只改 Luau 时重新安装即可。回到 GitHub 使用上面的更新命令。每次覆盖同一个复制安装目录，`plugin-data` 配置独立保留。

实时开发 Luau 可用 `tern plugin link ./packages/tern-context-broker` 直接引用源码，再用 `tern plugin reload` 重载。已有复制安装时 link 会失败；`--force` 也不会覆盖开发链接。建立链接前先备份或将旧复制目录移到系统废纸篓；切回复制安装前执行 `tern plugin unlink context-broker`。日志和运行配置放在链接源码之外。

修改 broker 扩展代码或配置后，在 OMP 执行 `/restart`。`/reload-plugins` 不重新执行已加载扩展，`tern plugin reload` 只重载配套插件。

在仓库根目录运行 `bun run test:ui`，脚本会在独立 Tern runtime 安装 release 归档，检查自动胶囊、提交、去重，以及手动 Unicode 替换、取消和焦点变化。截图与 provider 证据会保留；脚本结束自己启动的窗口和 daemon。

## 排障与草稿保护

命令没有打开弹框时，检查是否聚焦 OMP 输入框，以及光标是否在 `$` 或前缀后面。没有候选时，在 OMP 执行 `/context-broker doctor` 和 `/context-broker find <query>`，再核对配套插件使用相同 profile 和 roots。Node 启动失败时，确认 Tern 能找到 Node.js 22+，或显式设置 `node`。

OMP 拥有文本与光标状态。配套插件在显示弹框和应用结果前核对 pane 焦点、surface、editor、文本及光标；OMP 会拒绝原始文本长度已过期的编辑。中文和 emoji 偏移使用 UTF-16。草稿或焦点变化会取消待执行补全。

配套插件读取本地文件，并以当前权限启动 Node.js；候选文本不会作为 shell 命令执行。参见[安全策略](https://github.com/yoyooyooo/pi-context-broker/blob/main/SECURITY.md)与随包提供的 [MIT 许可证](./LICENSE)。
