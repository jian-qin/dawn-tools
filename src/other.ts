import { commands, window, env, Selection, EndOfLine } from 'vscode'
import { getNearMatch, getIndentationMode } from './tools'
import { createSourceFile, ScriptTarget } from 'typescript'

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

// 展开/收起光标所在括号内的内容
commands.registerCommand("dawn-tools.other.bracket", async (mode: 'collapse' | 'expand') => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  await commands.executeCommand('editor.action.selectToBracket')
  if (editor.selection.isEmpty) return
  const text = editor.document.getText(editor.selection)
  if (!['(', '[', '{'].includes(text[0])) return
  if (!text.replace(/^.(.+).$/s, '$1').trim()) return
  const tab = getIndentationMode().tab
  const newline = editor.document.eol === EndOfLine.LF ? '\n' : '\r\n'
  let _text = text
  // 对象需要特殊处理
  if (text[0] === '{') {
    _text = `[${text}]`
  }
  const ast: any = createSourceFile('temp.ts', _text, ScriptTarget.Latest, true).statements[0]
  let nodes: { pos: number, end: number }[] = []
  if (text[0] === '(') {
    nodes = ast.expression.parameters
  } else if (text[0] === '[') {
    nodes = ast.expression.elements
  } else if (text[0] === '{') {
    nodes = ast.expression.elements[0].properties
  }
  if (!nodes) return
  const items = nodes.map(item => _text.substring(item.pos, item.end).trim())
  let newText = ''
  if (mode === 'collapse') {
    // 换行的缩进-减少
    newText = items.map(item => item.replaceAll(newline + tab, newline)).join(', ')
    newText = text[0] === '{' ? `{ ${newText} }` : `${text.at(0)}${newText}${text.at(-1)}`
  } else {
    // 换行的缩进-增加
    const startLine = editor.document.lineAt(editor.selection.start.line)
    const baseTab = startLine.text.substring(0, startLine.firstNonWhitespaceCharacterIndex)
    newText = items.map(item => item.replaceAll(newline, newline + tab)).join(`,${newline}${baseTab}${tab}`)
    newText = `${text.at(0)}${newline}${baseTab}${tab}${newText}${newline}${baseTab}${text.at(-1)}`
  }
  await editor.edit(editBuilder => editBuilder.replace(editor.selection, newText))
  return newText
})
