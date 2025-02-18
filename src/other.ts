import { commands, window, env, Selection, Range } from 'vscode'
import {
  waitSelectionChange,
  getNearMatch,
  getIndentationMode,
  getBracketAst,
  getNearPosition,
  selectBracketAttr,
  getLineIndent,
} from './tools'

// 特殊粘贴
commands.registerCommand('dawn-tools.other.paste', async () => {
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
const symbol_values_reg = new RegExp(`(${symbol_values.map((val) => '\\' + val).join('|')})`, 'g')

// 替换光标最近（3行）的特殊符号
commands.registerCommand('dawn-tools.other.symbol', async (mode: 'toEN' | 'toCN') => {
  const match = getNearMatch(mode === 'toEN' ? symbol_keys_reg : symbol_values_reg)
  if (!match) return
  const editor = window.activeTextEditor!
  const value =
    mode === 'toEN'
      ? symbol_map[match.value as keyof typeof symbol_map]
      : symbol_keys[symbol_values.indexOf(match.value)]
  await editor.edit((editBuilder) => editBuilder.replace(match.range, value))
  return value
})

// 删除光标最近（3行）的单词
commands.registerCommand('dawn-tools.other.word.delete', async () => {
  const match = getNearMatch(/\w+/g)
  if (!match) return
  const editor = window.activeTextEditor!
  await editor.edit((editBuilder) => editBuilder.delete(match.range))
  editor.selection = new Selection(match.startPosition, match.startPosition)
  await env.clipboard.writeText(match.value)
  return match
})

// 删除光标最近（3行）的空白字符
commands.registerCommand('dawn-tools.other.gap.delete', async () => {
  const match = getNearMatch(/\s+/g)
  if (!match) return
  const editor = window.activeTextEditor!
  editor.edit((editBuilder) => editBuilder.delete(match.range))
  editor.selection = new Selection(match.startPosition, match.startPosition)
  return match
})

// 展开/收起光标所在括号内的内容
commands.registerCommand('dawn-tools.other.bracket', async () => {
  const nodes = await getBracketAst()
  if (!nodes?.length) return
  const editor = window.activeTextEditor!
  const text = editor.document.getText(editor.selection)
  const { tab, br } = getIndentationMode()
  let newText = ''
  if (nodes[0].start.line !== editor.selection.start.line) {
    // 换行的缩进-减少
    newText = nodes.map(({ text }) => text.replaceAll(br + tab, br)).join(', ')
    newText = text.at(0) === '{' ? `{ ${newText} }` : `${text.at(0)}${newText}${text.at(-1)}`
  } else {
    // 换行的缩进-增加
    const baseTab = getLineIndent(editor.selection.start.line).text
    newText = nodes.map(({ text }) => text.replaceAll(br, br + tab)).join(`,${br}${baseTab}${tab}`)
    newText = `${text.at(0)}${br}${baseTab}${tab}${newText}${br}${baseTab}${text.at(-1)}`
  }
  await editor.edit((editBuilder) => editBuilder.replace(editor.selection, newText))
  return newText
})

// 复制光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.copy', async (index?: number) => {
  const node = await selectBracketAttr(index)
  if (!node) return
  await env.clipboard.writeText(node.text)
  return node
})

// 删除光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.delete', async (index?: number) => {
  const node = await commands.executeCommand('dawn-tools.other.json.copy', index)
  if (!node) return
  await commands.executeCommand('deleteLeft')
  return node
})

// 粘贴光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.paste', async () => {
  let text = (await env.clipboard.readText()).trim().replace(/\s*,|;$/, '')
  if (!text) return
  const nodes = await getBracketAst()
  if (!nodes) return
  const editor = window.activeTextEditor!
  const selectionText = editor.document.getText(editor.selection)
  const { tab, br } = getIndentationMode()
  const baseTab = getLineIndent(editor.selection.start.line).text
  let editRange: Range
  let newIndex = 0
  if (nodes.length) {
    // 有属性
    const nearPosition = getNearPosition(
      nodes.active,
      nodes.flatMap(({ start, end }) => [start, end])
    )
    const positionType = nodes.some(({ start }) => nearPosition === start) ? 'start' : 'end'
    const nearNode = nodes.find(({ start, end }) => nearPosition === start || nearPosition === end)!
    newIndex = nodes.indexOf(nearNode) + (positionType === 'start' ? 0 : 1)
    const isSingleLine = editor.selection.start.line === nodes[0].start.line
    // 分隔符
    let delimiter = editor.document
      .getText(new Range(nodes[0].end, nodes[1]?.start || editor.selection.end.translate(0, -1)))
      .trim()
    if (!delimiter && nodes.length === 1) {
      delimiter = ','
    }
    if (nearPosition === nodes[0].start) {
      // 第一个属性
      editRange = new Range(editor.selection.start.translate(0, 1), nodes[0].start)
      text = isSingleLine
        ? `${selectionText[0] === '{' ? ' ' : ''}${text}${delimiter} `
        : `${br}${baseTab}${tab}${text}${delimiter}${br}${baseTab}${tab}`
    } else if (nearPosition === nodes.at(-1)!.end) {
      // 最后一个属性
      editRange = new Range(nodes.at(-1)!.end, editor.selection.end.translate(0, -1))
      text = isSingleLine
        ? `${delimiter} ${text}${selectionText[0] === '{' ? ' ' : ''}`
        : `${delimiter}${br}${baseTab}${tab}${text}${br}${baseTab}`
    } else {
      // 中间的属性
      editRange =
        positionType === 'start'
          ? new Range(nodes[nodes.indexOf(nearNode) - 1].end, nearNode.start)
          : new Range(nearNode.end, nodes[nodes.indexOf(nearNode) + 1].start)
      text = isSingleLine
        ? `${delimiter} ${text}${delimiter} `
        : `${delimiter}${br}${baseTab}${tab}${text}${delimiter}${br}${baseTab}${tab}`
    }
  } else {
    // 无属性
    editRange = editor.selection
    const start = selectionText.at(0)
    const end = selectionText.at(-1)
    if (editor.selection.isSingleLine) {
      text = start === '{' ? `{ ${text} }` : `${start}${text}${end}`
    } else {
      text = `${start}${br}${baseTab}${tab}${text}${br}${baseTab}${end}`
    }
  }
  await editor.edit((editBuilder) => editBuilder.replace(editRange, text))
  {
    const position = editor.selection.start.translate(0, 1)
    editor.selection = new Selection(position, position)
    await waitSelectionChange()
  }
  await selectBracketAttr(newIndex)
})
