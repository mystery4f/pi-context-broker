# pi-context-broker

[English](./README.md) | [中文](./README.zh-CN.md)

[安装](#安装) · [快速开始](#快速开始) · [Tern](#tern-补全) · [文档](#文档)

在 Pi 或 OMP 的 prompt 中点名，把本地 Skill 或 Bundle 索引加载到当前任务：

```text
$design-review review this API boundary
```

Broker 找到 `design-review`，将对应上下文发送给模型；只要正文仍在当前会话分支的有效上下文中，就不会重复追加。

## 为什么使用它

Agent 环境会逐渐积累评审清单、runbook 和团队流程。Context Broker 让你按任务选择所需上下文，无需在启动时加载所有文件。它发现本地文件和 catalog，不需要远程索引或 embedding。

| 记录 | 来源 | 模型收到的内容 |
| --- | --- | --- |
| Skill | 发现到的 `SKILL.md` | 完整 Skill 内容 |
| Bundle | YAML 或 JSON catalog | 描述、policy 和成员索引；成员正文按需读取 |

用 `$name` 或 alias 选择记录，也可以通过关键词规则加载 Skill 或显式的 `bundle:<name>` 目标。Broker 同时提供交互补全和 `/context-broker` 诊断命令。

## 安装

安装到你使用的宿主：

```bash
# Pi
pi install npm:pi-context-broker

# OMP
omp install npm:pi-context-broker
```

Broker 包需要 Node.js 22+。在 OMP 安装或升级后，输入 `/restart`，恢复当前会话并执行新版扩展代码。`/reload-plugins` 只刷新发现状态，不重新执行已加载扩展。

npm 包和 GitHub `main` 是独立的分发来源。npm 发新版前如需试用当前 checkout，在仓库根目录执行：

```bash
bun install --frozen-lockfile
bun run build

# 选择一个宿主
pi -e ./packages/context-broker/src/index.ts
omp -e ./packages/context-broker/src/index.ts
```

可选 Tern 配套插件使用独立的 [GitHub 安装入口](#tern-补全)。

## 快速开始

### 1. 配置 Skill 目录

Pi 创建 `~/.pi/agent/context-broker/config.yml`；OMP 创建 `~/.omp/agent/context-broker/config.yml`：

```yaml
skillRoots:
  - ~/context/skills
requireAutoload: false
pathMode: home-relative
logPaths: false
```

自定义 agent 目录或 OMP profile 时，参见[配置解析规则](./packages/context-broker/docs/reference.zh-CN.md#配置)。修改配置后重启宿主；OMP 使用 `/restart`。

### 2. 添加 Skill

创建 `~/context/skills/design-review/SKILL.md`：

```markdown
---
name: design-review
description: Review architecture and API trade-offs.
autoload:
  enabled: true
  aliases:
    - architecture-review
---

Review the design for ownership, boundaries, failure modes, and migration cost.
```

### 3. 检查发现结果，再提交

在宿主输入框执行：

```text
/context-broker doctor
/context-broker find design
/context-broker explain design-review
```

`doctor` 应显示 `Config diagnostics: ok`，且没有命名空间冲突；`explain` 应显示 `design-review` 的 `kind: skill` 和 `inject: full-file`。

然后提交：

```text
$design-review review this API boundary
```

下一次模型请求会包含 Skill 内容。正文仍有效时，再次提交同一记录会提示 `already loaded`。回退或压缩移除正文后可以重新加载；去重不会从后续请求中移除已经存在的上下文。

## Tern 补全

OMP 18.10.3+ 中输入 `$` 或 `$前缀`，broker 会自动显示候选下拉。方向键选择，Tab 或 Enter 接受，Esc 关闭。接受后显示原生胶囊；提交时展开回 `$name` 并注入。前缀可以紧接正文，一份草稿也可以包含多个引用。

可选 Tern 配套插件增加 **Ctrl+Alt+Shift+K** 手动搜索弹框，需要 Tern 0.8.3+、OMP 18.10.3+ 和 Node.js 22+，支持本地 OMP pane。直接从 GitHub 安装：

```bash
tern plugin install github.com/yoyooyooo/pi-context-broker/packages/tern-context-broker
```

GitHub 目录已经包含查询程序及其依赖，安装无需 Bun 构建或 npm 发版。两种补全都只编辑草稿；提交后的注入由 broker 完成。

两个插件可以同时安装：Tern 呈现原生界面，OMP 继续执行 broker 扩展，并负责上下文注入。从自动下拉切换到手动搜索时，先按 **Esc**，再按 **Ctrl+Alt+Shift+K**。两个菜单目前没有显式互斥，验收未覆盖同时打开。详见[双插件共存说明](./packages/tern-context-broker/README.zh-CN.md#双插件共存)。

配置、更新、卸载和本地开发见 [Tern 子包指南](./packages/tern-context-broker/README.zh-CN.md)。

## 文档

- [Broker 参考](./packages/context-broker/docs/reference.zh-CN.md)：Skill 优先级、Bundle、配置、环境变量、规则、payload 和补全 CLI。
- [Tern 子包指南](./packages/tern-context-broker/README.zh-CN.md)：手动搜索、profile、草稿保护，以及 GitHub 与本地构建切换。
- [配置示例](./packages/context-broker/examples/config.example.yml)和 [catalog 示例](./packages/context-broker/examples/discovery-catalog.example.yaml)。
- [贡献指南](./CONTRIBUTING.md)：开发检查、验收和发布流程。
- [变更记录](./CHANGELOG.md)和[安全策略](./SECURITY.md)。

## 隐私与支持

Broker 使用宿主 agent 的本地权限。选中的 Skill 内容会发送到你配置的模型 provider，并保存在会话历史中；Bundle 暴露成员 metadata 和路径，成员正文另行加载。请使用可信 roots 和 catalogs。路径默认尽量采用 home-relative；`pathMode: hash` 可以进一步隐藏路径，decision 日志默认不记录路径。

本地 Pi/OMP 检查在 macOS 运行过，CI 在 Linux 运行 CLI 和产物检查。Windows path-list 分隔符已适配，但 Windows 运行行为尚未验证。Tern 原生 UI 检查需要 macOS；手动配套插件不支持远程 pane 或 Tern web client。

Bug 请提交到 [GitHub Issues](https://github.com/yoyooyooo/pi-context-broker/issues)，漏洞使用[私密安全报告入口](https://github.com/yoyooyooo/pi-context-broker/security/advisories/new)。项目采用 [MIT](./LICENSE) 许可证；分发查询程序包含依赖许可声明。
