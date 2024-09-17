import { commands, window, env, Selection } from 'vscode'
import { getNearMatch } from './tools'

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
  const match = getNearMatch(mode === 'toEN' ? symbol_keys_reg : symbol_values_reg)
  if (!match) return
  const editor = window.activeTextEditor!
  const value = mode === 'toEN' ? symbol_map[match.value as keyof typeof symbol_map] : symbol_keys[symbol_values.indexOf(match.value)]
  await editor.edit(editBuilder => editBuilder.replace(match.range, value))
  return value
})

// 删除光标最近（3行）的单词
commands.registerCommand("dawn-tools.other.word.delete", async () => {
  const match = getNearMatch(/\w+/g)
  if (!match) return
  const editor = window.activeTextEditor!
  await editor.edit(editBuilder => editBuilder.delete(match.range))
  editor.selection = new Selection(match.startPosition, match.startPosition)
  await env.clipboard.writeText(match.value)
  return match.value
})
