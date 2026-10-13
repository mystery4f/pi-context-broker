--!strict
local composer = require("./composer")
local pending = false

local function complete(cx)
    if pending then return end
    local pane = cx.session:focused()
    if not pane then return end
    local saved = composer.snapshot(cx, pane)
    if not saved then
      cx:toast("info", "Context Broker", "Place the cursor after $ or a $name prefix in the OMP draft.")
      return
    end
    for _, host in cx.hosts:list() do
      for _, id in host.panes do
        if id == pane and host.kind ~= "local" then
          cx:toast("error", "Context Broker", "Completion queries currently require a local OMP pane.")
          return
        end
      end
    end
    local info = cx.session:pane(pane)
    if not info or not info.cwd or info.cwd == "" then
      cx:toast("error", "Context Broker", "The pane working directory is unavailable.")
      return
    end
    local settingsPath = tern.plugin.data .. "/config.json"
    local settings = {}
    if tern.fs.exists(settingsPath) then
      local ok, value = pcall(function() return tern.json.decode(tern.fs.read(settingsPath, 16384)) end)
      if not ok or type(value) ~= "table" then
        cx:toast("error", "Context Broker", "Invalid plugin-data/context-broker/config.json.")
        return
      end
      settings = value
    end
    for _, key in { "node", "config", "agentDir" } do
      if settings[key] ~= nil and (type(settings[key]) ~= "string" or settings[key] == "") then
        cx:toast("error", "Context Broker", key .. " must be a nonempty path.")
        return
      end
    end
    local queryPath = tern.plugin.dir .. "/query/completion.mjs"
    if not tern.fs.exists(queryPath) then
      cx:toast("error", "Context Broker", "Missing bundled query. Install a release package or run bun run build before linking.")
      return
    end
    local request = { version = 1, text = saved.text, cursor = saved.cursor, cwd = info.cwd, config = settings.config }
    local env = { CONTEXT_BROKER_HOST = "omp" }
    if settings.agentDir then env.PI_CODING_AGENT_DIR = settings.agentDir end
    pending = true
    local started, failure = pcall(function()
      tern.process.run({ settings.node or "node", queryPath }, {
        cwd = info.cwd, env = env, stdin = tern.json.encode(request), timeout_ms = 10000,
      }, function(result, queryCx)
        pending = false
        if not queryCx then return end
        if result.status ~= 0 then
          queryCx:toast("error", "Context Broker query failed", string.sub(result.stderr, 1, 500))
          return
        end
        if queryCx.session:focused() ~= saved.pane or not composer.unchanged(queryCx, saved) then
          queryCx:toast("info", "Context Broker", "Draft or focus changed; completion cancelled.")
          return
        end
        local ok, response = pcall(function() return tern.json.decode(result.stdout) end)
        if not ok or type(response) ~= "table" or response.version ~= 1
          or type(response.edit) ~= "table" or type(response.items) ~= "table" then
          queryCx:toast("error", "Context Broker", "Invalid completion query response.")
          return
        end
        local edit = response.edit
        if edit.prefix ~= saved.prefix or edit.to ~= saved.cursor
          or edit.from ~= saved.cursor - composer.utf16_length(saved.prefix)
          or edit.len ~= composer.utf16_length(saved.text) then
          queryCx:toast("error", "Context Broker", "Completion range does not match the draft.")
          return
        end
        local items = {}
        for _, item in response.items do
          if type(item) ~= "table" or type(item.value) ~= "string" or type(item.label) ~= "string"
            or string.sub(item.value, 1, 1) ~= "$" or string.find(item.value, "%s")
            or (item.description ~= nil and type(item.description) ~= "string") then
            queryCx:toast("error", "Context Broker", "Invalid completion candidate.")
            return
          end
          table.insert(items, { label = item.label, detail = item.description, value = item.value })
        end
        if #items == 0 then
          queryCx:toast("info", "Context Broker", "No configured Skill or Bundle matches " .. saved.prefix .. ".")
          return
        end
        pending = true
        queryCx:pick({ items = items, placeholder = "Search Context Broker Skills and Bundles", action = "insert" })
          :next(function(item, err, pickCx)
            pending = false
            if not pickCx then return end
            if err then pickCx:toast("error", "Context Broker", err) return end
            if not item then return end
            if pickCx.session:focused() ~= saved.pane or not composer.unchanged(pickCx, saved) then
              pickCx:toast("info", "Context Broker", "Draft or focus changed; completion cancelled.")
              return
            end
            local byte = composer.byte_offset(saved.text, saved.cursor)
            if byte == nil then return end
            local suffix = if string.sub(saved.text, byte + 1, byte + 1) == " " then "" else " "
            local replacement = item.value .. suffix
            pickCx.session:event(saved.pane, {
              ev = "edit", id = saved.id, from = edit.from, to = edit.to,
              text = replacement, cursor = edit.from + composer.utf16_length(replacement), len = edit.len,
            })
          end)
      end)
    end)
    if not started then
      pending = false
      cx:toast("error", "Context Broker", "Cannot start Node.js 22+: " .. tostring(failure))
    end
end

tern.command({
  id = "complete",
  title = "Complete Context Broker Skill or Bundle",
  icon = "puzzle",
  keys = { "ctrl+alt+shift+k" },
  run = complete,
})

