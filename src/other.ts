import { commands, window, Range, env } from 'vscode'

// 特殊粘贴
commands.registerCommand("dawn-tools.other.paste", async () => {
  const text = (await env.clipboard.readText()).trim()
  if (text.startsWith('.') || text.startsWith('/')) {
    await commands.executeCommand('dawn-tools.file.copy.path.paste')
  } else {
    await commands.executeCommand('dawn-tools.html.attr.paste')
  }
})

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
const symbol_keys = Object.keys(symbol_map)
const symbol_values = Object.values(symbol_map)
const symbol_keys_reg = new RegExp(`(${symbol_keys.join('|')})`, 'g')
const symbol_values_reg = new RegExp(`(${symbol_values.map(val => '\\' + val).join('|')})`, 'g')

// 替换光标最近（3行）的特殊符号
commands.registerCommand("dawn-tools.other.symbol", async (mode: 'toEN' | 'toCN') => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const position = editor.selection.end
  const range = new Range(
    position.line && position.line - 1, 0,
    position.line + 2, 0,
  )
  const text = editor.document.getText(range)
  const matchs = [...text.matchAll(mode === 'toEN' ? symbol_keys_reg : symbol_values_reg)]
  if (!matchs.length) return
  // 距离最近的符号
  const startIndex = editor.document.offsetAt(position) - editor.document.offsetAt(range.start) - 1
  const indexs = matchs.map(item => Math.abs(startIndex - item.index))
  const match = matchs[indexs.indexOf(Math.min(...indexs))]
  const value = mode === 'toEN' ? symbol_map[match[1] as keyof typeof symbol_map] : symbol_keys[symbol_values.indexOf(match[1])]
  // 替换
  const startPosition = editor.document.positionAt(editor.document.offsetAt(range.start) + match.index)
  await editor.edit(editBuilder => editBuilder.replace(new Range(
    startPosition,
    startPosition.translate(0, match[1].length),
  ), value))
  return match
})

// 删除光标最近（3行）的单词
commands.registerCommand("dawn-tools.other.word.delete", async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
})
