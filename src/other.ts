import { commands, window, Range } from 'vscode'

const symbol_map = {
  '·': '`',
  '！': '!',
  '￥': '$',
  '……': '^',
  '（': '(',
  '）': ')',
  '——': '_',
  '【': '[',
  '】': ']',
  '、': '\\',
  '；': ';',
  '：': ':',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '，': ',',
  '《': '<',
  '。': '.',
  '》': '>',
  '？': '?',
}
const symbol_map_get = (() => {
  const keys = `(${Object.keys(symbol_map).join('|')})`
  const reg = new RegExp(`${keys}[^${keys}]*?$`)
  return (text: string) => {
    const match = text.match(reg)
    return match && {
      key: match[1],
      value: symbol_map[match[1] as keyof typeof symbol_map],
      index: match.index!,
    }
  }
})()

// 替换特殊符号
commands.registerCommand("dawn-tools.other.symbol", async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const line = editor.document.lineAt(editor.selection.start.line)
  const match = symbol_map_get(line.text)
  if (!match) return
  await editor.edit(editBuilder => editBuilder.replace(new Range(
    editor.selection.start.line,
    match.index,
    editor.selection.start.line,
    match.index + match.key.length
  ), match.value))
  return match
})
