# OMP 自动补全与 Tern 手动搜索

自动候选属于 OMP 扩展，接受后成为可整体删除/撤销的原生胶囊；Tern companion 提供显式快捷键搜索，选择只修改草稿。

## Sub-features

- `editor-auto`：正文后的 `$prefix` 出现候选，Tab 接受 Skill/Bundle 为胶囊。
- `editor-atomic`：整体删除、撤销、同一草稿多引用，提交时展开为 `$name`。
- `editor-submit`：Skill/Bundle 混合提交和重复提交的 provider 正文/索引数量正确。
- `editor-manual`：中文/emoji 中间光标的手动替换保持两侧文本且不提交。
- `editor-dismiss`：Esc 取消与焦点变化不修改草稿、不调用 provider。

## How to get to it (user POV)

- 在 OMP composer 输入 `$` 或 `$prefix`，方向键选候选，Tab/Enter 接受，Esc 关闭。
- 在 Tern 的本地 OMP pane 输入 `$prefix`，按 Ctrl+Alt+Shift+K，搜索并选择候选。
- 用退格、撤销以及提交操作胶囊，或关闭手动搜索后继续编辑。

## Driving it with control.mjs

Preconditions:

- macOS、Tern 0.8.3+、OMP 18.10.3+、Node.js 22+、Bun、tar；Tern 的已有 OS 登录可用。
- `bun run build` 生成查询产物；`control.mjs doctor editor` ready。
- 原生 runner 创建独立 daemon、window、config；禁止对用户已有窗口发送 ctl。

- **完整原生路径。** 执行 `node .agents/skills/verify-context-broker/scripts/control.mjs run editor`。runner 解包 Tern archive 并通过 `tern plugin install` 安装，启动自己的 daemon/window，等待 shell/OMP editor 后输入 `中文😀正文$ui-a`、Tab 接受，退格整项删除，Ctrl+Z 撤销；继续接受 `$ui-bu` 后提交。provider 收到 `$ui-alpha`、`$ui-bundle`，正文/Bundle block 各一份。
- **重复。** 再次接受并提交 `$ui-alpha`，第二次 provider 请求仍各只有一份已加载上下文。
- **手动 Unicode 替换。** 草稿 `前文😀$ui-a tail`，光标位于 `$ui-a` 末尾；Esc 关闭自动候选，Ctrl+Alt+Shift+K 打开 `Search Context Broker Skills and Bundles`。Enter 选中后成为 `前文😀$ui-alpha tail`，provider 请求仍为两次。
- **取消与焦点。** `$ui-` 手动搜索后 Esc，草稿不变；`$ui-a` 手动搜索后点击当前 `.sf-editor` rect，picker 关闭、文本不变、provider 无新请求。
- **句柄。** runner 使用 `tern ctl --control <本次socket> tree .sf-editor`、`tree input`、`key`、`type`、`shot`。传给 `type` 的文字采用 JSON 编码；点击坐标来自当前 rect，不复用历史截图坐标。
- **证据与 teardown。** manifest 指向 `broker-native-ui-*`：`shots/live/automatic-mixed.png`、`manual-picker.png`、`manual-replacement.png` 及 layout JSON，`provider.jsonl`、`sessions`、`owned-processes.json`、`cleanup.json`。检查截图可见正确胶囊与 picker，cleanup stopped 为 true，再运行 `control.mjs evidence`。

## Gotchas

- UI runner 的确认仅覆盖 Tab 自动接受；用户支持的方向选择、Enter 接受或纯 OMP TUI 若被修改，需补驱动，不能由本路径代替。
- 手动搜索使用配置 roots/catalogs，不继承 system prompt 中隐藏的 Skill。
- 当前脚本用 `What are we cooking?` 判断空 composer；宿主文案变化时先检查实际 idle 状态，不因超时就修改业务断言。
- companion 通过唯一 config/socket 隔离，但保留进程 PATH 和 OS 登录。不要声称它像 fake-provider CLI 一样隔离全部凭据。
- 源码下的 Tern plugin 缺构建 query 时不能安装；修改扩展用 `/restart`，修改 companion 用 `tern plugin reload`。
- 远端 pane、Tern web client 和非 macOS 原生 runner 未被此路径覆盖。
