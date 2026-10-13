--!strict
local composer = {}

function composer.find(node)
  if type(node) ~= "table" then return nil end
  if node.k == "editor" and type(node.p) == "table"
    and type(node.p.text) == "string" and type(node.p.cursor) == "number"
    and node.p.readonly ~= true and node.p.disabled ~= true and node.p.hidden ~= true then
    return node
  end
  for _, child in node.c or {} do
    local found = composer.find(child)
    if found then return found end
  end
  return nil
end

function composer.utf16_length(text: string): number
  local length = 0
  for _, codepoint in utf8.codes(text) do
    length += if codepoint > 0xFFFF then 2 else 1
  end
  return length
end

function composer.byte_offset(text: string, offset: number): number?
  if offset < 0 or offset % 1 ~= 0 then return nil end
  local units = 0
  for byte, codepoint in utf8.codes(text) do
    if units == offset then return byte - 1 end
    units += if codepoint > 0xFFFF then 2 else 1
    if units > offset then return nil end
  end
  return if units == offset then #text else nil
end

function composer.prefix(text: string, cursor: number): string?
  local byte = composer.byte_offset(text, cursor)
  if not byte then return nil end
  local before = string.sub(text, 1, byte)
  local prefix = string.match(before, "%$[^%s%$]*$")
  if not prefix then return nil end
  return prefix
end

function composer.snapshot(cx, pane: number)
  local tree = cx.session:surface(pane)
  if type(tree) ~= "table" or type(tree.surface) ~= "table" or tree.surface.role ~= "omp.session" then return nil end
  local field = composer.find(tree.dock)
  if not field then return nil end
  local prefix = composer.prefix(field.p.text, field.p.cursor)
  if not prefix then return nil end
  return { pane = pane, surface = tree.surface.id, id = field.id, text = field.p.text, cursor = field.p.cursor, prefix = prefix }
end

function composer.unchanged(cx, saved): boolean
  local current = composer.snapshot(cx, saved.pane)
  return current ~= nil and current.surface == saved.surface and current.id == saved.id
    and current.text == saved.text and current.cursor == saved.cursor
end

return composer
