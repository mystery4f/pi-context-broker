# 真实模型指令效果与默认压缩

实际模型应接收 Skill、按其中专属指令回答；重复调用不新增正文，默认摘要器移除正文后再次调用可重新注入。

## Sub-features

- `model-instruction`：请求没有提供输出格式，模型仍按 Skill 的专属格式计算。
- `model-repeat`：重复请求的正文计数保持一份，broker 判断 already-loaded。
- `model-default-compact`：真实默认摘要器运行，`fromExtension: false`，正文 canary 从有效上下文移除。
- `model-reinject`：压缩后再次引用重新注入，模型恢复执行指令。
- `model-selector`：普通与摘要请求实际传输 selector 都属于指定免费模型。

## How to get to it (user POV)

- 使用 `magpie/group/flash-free` 的 OMP 会话提交 `$model-contract Apply the ledger contract to 17 and 25.`。
- 再提交 6 和 9，添加普通历史，再运行宿主压缩并重新引用处理 30 和 12。

## Driving it with control.mjs

Preconditions:

- 已有该模型的调用授权和可用 OMP 登录，不要求新增/查看/输出 secret。
- Node.js 22+、Bun、OMP；`control.mjs doctor model` ready。Doctor 不验证认证。
- 本路径继承现有 provider 配置与登录；session/config fixtures 隔离，不更改用户模型。

- **执行。** 运行 `node .agents/skills/verify-context-broker/scripts/control.mjs run model`。脚本真实提交两次 ledger 请求；输出分别应是 `VIOLET-78C4|total=42|checks=boundary,ownership` 与 total=15，格式只存在于注入 Skill。
- **默认压缩。** 添加普通 notes，调用原生 `compact`，观察 `fromExtension: false` 和 `get_messages` 中 canary 为零。之后请求 30 和 12，结果恢复 total=42。
- **传输。** 普通请求四次、每次正文 canary 为一；包括摘要的 transport 总数至少五次，selector 仅 `group/flash-free` 或完整 `magpie/group/flash-free`。数目允许默认摘要器分段；不能固定成历史某次运行的七次。
- **证据。** manifest 指向 `broker-real-model-*`：`result.json`、`evidence.jsonl`、`decisions.jsonl`、`sessions`。capture 只含 phase、selector、canary 计数与响应/摘要状态；核对首次 inject、重复 skip、压缩后 inject。RPC teardown 后执行 `control.mjs evidence`。

## Gotchas

- 不改成其他模型来让验收通过；登录/模型不可用要报告当前失败，完成无凭据路径。
- 摘要中保留原指令含义是正常的；此场景只要求全文 canary 不在有效上下文，随后确实重新注入。
- 指令专属输出证明模型在该次请求使用了内容，不证明任意 Skill、任意输入或长期推理正确。
- 默认 role 与 compaction 路由可能选择其他模型，现有脚本在 actual fetch boundary 拒绝越界 selector；不要只看启动参数认定调用模型。
- 真实请求不放到无凭据 CI；严禁把 URL、header、token 或个人会话写入 capture。
