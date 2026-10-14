# Broker 参考

[English](./reference.md) | [中文](./reference.zh-CN.md) · [项目概览](https://github.com/yoyooyooo/pi-context-broker/blob/main/README.zh-CN.md)

Pi/OMP broker 的完整配置、发现与注入参考。首次使用先看[快速开始](../README.zh-CN.md#快速开始)。

[Skills](#skills) · [Bundles](#bundles) · [配置](#配置) · [规则](#rule-files) · [命令](#命令) · [补全 CLI](#补全-cli)

## Skills

Context Broker 会发现 `skillRoots` 下的每个 `SKILL.md`。

`$` 发现与配置驱动的 Skill 调用均按 root 顺序扫描，同一规范化 Skill 名保留第一条。希望优先使用已分发版本时，把运行时目录放在源码目录前面。扫描会跟随目录和 `SKILL.md` 软链接，但保留发现时的路径作为相对引用基准；断链和指向祖先的循环链接会跳过，深度、忽略目录和文件大小限制仍然有效。这不会重写 Skill 正文中的链接或 Bundle 显式成员路径。

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

`requireAutoload` 默认为 `true`，配置驱动的 Skill 调用和关键词规则仅匹配 `autoload.enabled: true` 的 Skill。显式 `$name` 查找和补全不受此开关限制。`CONTEXT_BROKER_REQUIRE_ENABLED` 可以覆盖配置调用和规则使用的开关。

## Bundles

Bundle 写在 discovery catalog 里。它注入索引，不注入完整成员文件。

Context Broker 不生成持久化的 Bundle 或 Router Skill。需要分发路由入口的仓库，应将它作为普通 `SKILL.md` 管理，由 `skillRoots` 发现。

```yaml
version: 1
records:
  - kind: bundle
    name: workspace-collab
    description: Collaboration contexts for documents, chat, and tasks.
    aliases:
      - collab
    render:
      type: member-index
      rules:
        - This is a context bundle index, not a concrete skill.
        - Select the needed member before acting.
        - Read the selected member file before using member-specific details.
    policy:
      memberBody: read-before-use
      scope: members-only
    members:
      include:
        - docs
        - chat
```

输入 `$workspace-collab` 时，模型会看到 bundle 描述、policy 和成员列表。它不会自动收到 `docs` 和 `chat` 的正文，除非后续步骤读取它们。

规则也可以注入同一份轻量索引，而不加载成员正文：

```yaml
id: collaboration-keywords
inject:
  - bundle:workspace-collab
match:
  - contains:
      - 团队协作
```

规则目标必须显式使用 `bundle:` 前缀；不带前缀的目标保持原有的 Skill-only 行为。Bundle 规则只按已配置 discovery catalog 中的精确 name 或 alias 匹配，不做模糊匹配。

## 配置

配置解析顺序：

1. `CONTEXT_BROKER_CONFIG`
2. `<agentDir>/context-broker/config.yml`
3. `<agentDir>/context-broker/config.yaml`
4. `<agentDir>/context-broker/config.json`

设置了 `PI_CODING_AGENT_DIR` 时，`agentDir` 使用该路径。否则使用宿主默认值：

- Pi: `~/.pi/agent`
- OMP: `~/${PI_CONFIG_DIR:-.omp}/agent`

完整配置示例：

```yaml
skillRoots:
  - ~/context/skills
extraSkillRoots:
  - ./.agents/skills

# 不设置时，broker 使用配置文件旁边的 rules 目录。
ruleRoots:
  - ./context-broker/rules

discoveryCatalogs:
  - ~/context/catalogs/workspace.yaml
extraDiscoveryCatalogs:
  - ./context/catalogs/project.yaml

requireAutoload: true

# absolute | home-relative | basename | hash
pathMode: home-relative
logPaths: false

scan:
  maxDepth: 8
  maxSkillBytes: 65536
  ignore:
    - .git
    - node_modules
    - dist
    - build
    - coverage
```

### 环境变量

| 变量 | 作用 |
| --- | --- |
| `CONTEXT_BROKER_CONFIG` | 使用一个显式 config 文件 |
| `CONTEXT_BROKER_ROOTS` | 用 path-list 替换 `skillRoots` |
| `CONTEXT_BROKER_EXTRA_ROOTS` | 追加 skill roots |
| `CONTEXT_BROKER_DISCOVERY_CATALOGS` | 用 path-list 替换 `discoveryCatalogs` |
| `CONTEXT_BROKER_EXTRA_DISCOVERY_CATALOGS` | 追加 discovery catalogs |
| `CONTEXT_BROKER_REQUIRE_ENABLED=0` | 规则匹配时允许所有发现到的 skills |
| `CONTEXT_BROKER_REQUIRE_ENABLED=1` | 强制要求 `autoload.enabled: true` |
| `CONTEXT_BROKER_LOG_FILE` | 写入 JSONL decisions 和 injections |
| `CONTEXT_BROKER_HOST=pi\|omp` | 强制宿主默认路径解析 |

Path-list 分隔符跟随平台：macOS/Linux 用 `:`，Windows 用 `;`。

## Rule files

Rule files 默认放在 `context-broker/rules/*.yml`。每个文件描述一个触发 profile。

```yaml
id: architecture-review
inject:
  - design-review
  - bundle:workspace-collab
match:
  - exact:
      - review this design
  - regex:
      - '^design review:'
  - contains:
      - architecture
    not:
      - contains:
          - no context
```

一个生成文件也可以通过顶层 `rules` 数组声明多个 profile；这适合由同一份场景配置投影一组 Bundle 触发规则：

```yaml
version: 1
rules:
  - id: scene-coding
    inject:
      - bundle:scene-coding
    match:
      - contains:
          - 编码场景
  - id: scene-research
    inject:
      - bundle:scene-research
    match:
      - contains:
          - 深度研究
```

旧的单 profile 文件格式继续兼容。若顶层 `rules` 非空，插件以其中的有效规则为准。

如果想换 rule 目录，设置 `ruleRoots`。

## Discovery catalogs

Catalog 是独立 YAML 或 JSON 文件。YAML 更容易 review，是推荐格式。

成员可以按 name 引用已发现 skill：

```yaml
members:
  include:
    - docs
    - chat
```

成员也可以指向 catalog 相对路径下的文件：

```yaml
members:
  - path: ./members/docs/SKILL.md
```

如果文件是 `SKILL.md`，Context Broker 可以从 frontmatter 读取 `name` 和 `description`。只有需要覆盖 metadata 时，才需要手写这两个字段。

完整示例见 [`discovery-catalog.example.yaml`](../examples/discovery-catalog.example.yaml)。

## 注入 payload

Skill 注入：

```xml
<context-broker-record kind="skill" name="design-review" path="~/context/skills/design-review/SKILL.md">
<body>
Review the design for ownership, boundaries, failure modes, and migration cost.
</body>
</context-broker-record>
```

Bundle 注入：

```xml
<context-broker-record kind="bundle" name="workspace-collab" path="~/context/catalogs/workspace.yaml">
  <description>Collaboration contexts for documents, chat, and tasks.</description>
  <rules>
    <rule>Read the selected member file before using member-specific details.</rule>
  </rules>
  <policy memberBody="read-before-use" scope="members-only"></policy>
  <members>
    <member name="docs" path="~/context/skills/docs/SKILL.md">Document reading and editing context.</member>
  </members>
</context-broker-record>
```

## 命令

```text
/context-broker status
/context-broker doctor
/context-broker roots
/context-broker catalogs
/context-broker find <query>
/context-broker explain <record>
```

用子命令，不要用 colon-style command name。Pi 会把 colon suffix 用于命令冲突消歧。

## 安全与隐私

这个包运行在宿主 agent 进程里，权限等同于宿主。只从可信来源安装。

Context Broker 的设计目标就是把你选中的上下文发给模型：

- 匹配到 `skill` 时，完整 `SKILL.md` body 会发送给模型，并写入本地 session history。
- 匹配到 `bundle` 时，只发送成员 name、description、policy 和 member path，不发送成员 body。
- Session JSONL 会保存注入内容。
- `CONTEXT_BROKER_LOG_FILE` 会记录匹配 query 和 record name。除非设置 `logPaths: true`，否则不会记录路径。
- `pathMode: home-relative` 会尽量避免暴露完整 home 目录路径。
- `pathMode: hash` 可以进一步隐藏路径。

不要把 `skillRoots` 指向不可信仓库。Skill 本质上是 prompt content，可以指挥模型。

## 会话去重

Broker 注入前检查当前分支的有效上下文。再次提交同一记录会提示 `already loaded`，不会追加第二份正文；已加载的正文仍随会话上下文发送给模型。

Fork 保留正文时仍跳过；回退或压缩移除正文后可以重新注入。普通用户、助手或工具消息里的 XML 示例不算加载证据。

## 补全 CLI

npm 包提供 `context-broker-complete`，从 stdin 接收一条 version 1 JSON 请求，向 stdout 返回一条 JSON 响应。它按 `cwd` 查询配置中的 roots 和 catalogs，不继承宿主系统提示中的 Skill，也不返回 Skill 正文；诊断写入 stderr。

```json
{"version":1,"text":"Use$des","cursor":7,"cwd":"/workspace/example"}
```

可选字段 `config` 用于指定 broker 配置路径。所有偏移都以 UTF-16 code units 计数，包括 `edit.len` 中的原始文本长度：

```json
{"version":1,"edit":{"from":3,"to":7,"len":7,"prefix":"$des"},"items":[{"value":"$design-review","label":"$design-review [skill]","description":"Review architecture and API trade-offs."}]}
```

这个响应假设配置中存在快速开始里的 Skill。`edit: null` 表示光标前没有 `$` 补全前缀；光标落在 emoji surrogate pair 中间会被拒绝。别名、模糊排序与 Bundle 优先规则和 broker 共用；调用方应用编辑前必须检查草稿没有变化。
