import { commands, window, env, Selection, EndOfLine } from 'vscode'
import { getNearMatch, getIndentationMode, getBracketAst, getNearPosition, positionOffset } from './tools'

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
  '、': '/',
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

// 展开/收起光标所在括号内的内容
commands.registerCommand("dawn-tools.other.bracket", async (mode: 'collapse' | 'expand') => {
  const nodes = await getBracketAst()
  if (!nodes?.length) return
  const editor = window.activeTextEditor!
  const text = editor.document.getText(editor.selection)
  const tab = getIndentationMode().tab
  const newline = editor.document.eol === EndOfLine.LF ? '\n' : '\r\n'
  let newText = ''
  if (mode === 'collapse') {
    // 换行的缩进-减少
    newText = nodes.map(({ text }) => text.replaceAll(newline + tab, newline)).join(', ')
    newText = text[0] === '{' ? `{ ${newText} }` : `${text.at(0)}${newText}${text.at(-1)}`
  } else {
    // 换行的缩进-增加
    const startLine = editor.document.lineAt(editor.selection.start.line)
    const baseTab = startLine.text.substring(0, startLine.firstNonWhitespaceCharacterIndex)
    newText = nodes.map(({ text }) => text.replaceAll(newline, newline + tab)).join(`,${newline}${baseTab}${tab}`)
    newText = `${text.at(0)}${newline}${baseTab}${tab}${newText}${newline}${baseTab}${text.at(-1)}`
  }
  await editor.edit(editBuilder => editBuilder.replace(editor.selection, newText))
  return newText
})

// 复制光标所在括号内的属性
commands.registerCommand("dawn-tools.other.json.copy", async () => {
  const nodes = await getBracketAst()
  if (!nodes?.length) return
  const editor = window.activeTextEditor!
  const nearPosition = getNearPosition(nodes.active, nodes.flatMap(({ start, end }) => [start, end]))
  const nearNode = nodes.find(({ start, end }) => nearPosition === start || nearPosition === end)!
  let { start, end } = nearNode
  if (nodes.length === 1) {
    // 只有一个属性
    start = positionOffset(editor.selection.start, 1)
    end = positionOffset(editor.selection.end, -1)
  } else if (nodes.at(-1) === nearNode) {
    // 最后一个属性
    start = nodes[nodes.indexOf(nearNode) - 1].end
    const afterText = editor.document.getText(new Selection(nearNode.end, editor.selection.end))
    const offset = afterText.match(/,|;/)
    if (offset) {
      end = positionOffset(nearNode.end, offset.index! + 1)
    }
  } else {
    end = nodes[nodes.indexOf(nearNode) + 1].start
  }
  editor.selection = new Selection(start, end)
  env.clipboard.writeText(editor.document.getText(editor.selection))
  return true
})

// 删除光标所在括号内的属性
commands.registerCommand("dawn-tools.other.json.delete", async () => {
  const isCopy = await commands.executeCommand('dawn-tools.other.json.copy')
  if (!isCopy) return false
  await commands.executeCommand('deleteLeft')
  return true
})
