import { commands, window, Range, Selection, Position, workspace, EndOfLine } from 'vscode'
import { parser } from 'posthtml-parser'
import { tokenize, constructTree } from 'hyntax'
import { createSourceFile, ScriptTarget } from 'typescript'

// 等待editor.selection修改完成
export function waitSelectionChange() {
  return new Promise<void>((resolve) => {
    const { dispose } = window.onDidChangeTextEditorSelection(() => {
      dispose()
      resolve()
    })
  })
}

// 当前行不为空行时，向下插入一行
export async function insertLineIfNotEmpty() {
  const editor = window.activeTextEditor!
  if (editor.selection.start.line !== editor.selection.end.line) {
    // 多行选中时，光标右移跳转到最后一行，避免插入行的位置不对
    await commands.executeCommand('cursorRight')
  }
  const isEmptyLine = editor.document.lineAt(editor.selection.active.line).isEmptyOrWhitespace
  if (!isEmptyLine) {
    await commands.executeCommand('editor.action.insertLineAfter')
  }
}

// 格式化文件路径（统一斜杠、大小写盘符、去除盘符前的斜杠）
export function formatFilePath(path: string) {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/([a-zA-Z]:)/, '$1')
    .replace(/^[a-z]:/, ($0) => $0.toUpperCase())
}

// 获取文件对应的根目录
export function getRootPath(path: string) {
  path = formatFilePath(path)
  const roots = workspace.workspaceFolders!.map((root) => formatFilePath(root.uri.path))
  return roots.find((root) => path.startsWith(root))!
}

// 获取文件路径中的文件名
export function getFileName(path: string) {
  const result = formatFilePath(path).split('/')
  let name = result.at(-1)?.replace(/(.+)\..*/, '$1')
  // 特殊名称过滤
  if (name === 'index') {
    name = result.at(-2)
  }
  return name
}

// 获取当前文件的缩进模式
export function getIndentationMode() {
  const editor = window.activeTextEditor!
  const indentMode = editor.options.insertSpaces!
  const tabSize = editor.options.tabSize!
  return {
    mode: indentMode ? 'space' : 'tab',
    size: tabSize,
    tab: indentMode ? ' '.repeat(Number(tabSize)) : '\t',
    br: editor.document.eol === EndOfLine.LF ? '\n' : '\r\n',
  }
}

// 获取指定行的缩进
export function getLineIndent(line: number) {
  const textLine = window.activeTextEditor!.document.lineAt(line)
  const text = textLine.text.substring(0, textLine.firstNonWhitespaceCharacterIndex)
  return {
    text,
    tabSize: text.replaceAll(getIndentationMode().tab, ' ').length,
  }
}

// 获取光标位置的偏移坐标
export function positionOffset(position: Position, offset: number) {
  const document = window.activeTextEditor!.document
  const max = document.getText().length - 1
  let index = document.offsetAt(position) + offset
  if (index < 0) {
    index = 0
  } else if (index > max) {
    index = max
  }
  return document.positionAt(index)
}

// 获取指定位置最近的位置
export function getNearPosition(position: Position, positions: Position[]) {
  const editor = window.activeTextEditor!
  const offset = editor.document.offsetAt(position)
  const offsets = positions.map((item) => editor.document.offsetAt(item))
  const offsetsAbs = offsets.map((item) => Math.abs(offset - item))
  const min = Math.min(...offsetsAbs)
  return positions[offsetsAbs.indexOf(min)]
}

// 获取标签开始位置的下标
export function getHtmlStartIndex(position: Position) {
  const document = window.activeTextEditor?.document
  if (!document) return
  const index = document.offsetAt(position) + 1
  if (index < 1) return
  const text = document.getText().substring(0, index)
  if (text.at(-1) === '<') return position
  const matchArr = text.match(/<\w+/g)
  if (!matchArr) return
  const matchIndex = text.lastIndexOf(matchArr.at(-1) as string)
  if (matchIndex === -1) return
  return document.positionAt(matchIndex)
}

// 获取标签结束位置的下标
export function getHtmlEndIndex(beforePosition: Position) {
  const document = window.activeTextEditor?.document
  if (!document) return
  const beforeIndex = document.offsetAt(beforePosition)
  const text = document.getText().substring(beforeIndex)
  const reg = />/g
  let afterIndex
  do {
    const match = reg.exec(text)
    if (!match) return
    const tag = text.substring(0, match.index + 1)
    // 是否合法的 html 标签
    const ast: any = parser(tag)
    // 开始标签匹配失败
    if (!ast[0]?.tag) continue
    afterIndex = beforeIndex + match.index + 1
    break
  } while (reg.lastIndex < text.length)
  if (!afterIndex) return
  return document.positionAt(afterIndex)
}

// 获取光标所在的标签位置
export function getNowHtmlTagRange() {
  // 循环匹配标签位置
  let currentPosition = window.activeTextEditor?.selection.active
  if (!currentPosition) return
  let beforePosition: ReturnType<typeof getHtmlStartIndex>
  let afterPosition: ReturnType<typeof getHtmlEndIndex>
  do {
    beforePosition = getHtmlStartIndex(currentPosition)
    if (!beforePosition) return
    afterPosition = getHtmlEndIndex(beforePosition)
    if (afterPosition) break
    currentPosition = beforePosition
  } while (true)
  return new Range(beforePosition, afterPosition)
}

// 获取html标签的ast语法树
export function getHtmlAst(tag: string) {
  const ast: any = constructTree(tokenize(tag).tokens).ast.content.children[0].content
  const openStartOldLen = ast.openStart.content.length
  ast.openStart.content = ast.openStart.content.trimEnd()
  ast.openStart.endPosition -= openStartOldLen - ast.openStart.content.length
  ast.selfClosing = ast.openEnd.content[0] === '/'
  ast.attributes ||= []
  ast.attributes = ast.attributes.flatMap((attr: any) => {
    const keyOldLen = attr.key.content.length
    attr.key.content = attr.key.content.trimEnd()
    attr.key.endPosition -= keyOldLen - attr.key.content.length
    let content = attr.key.content
    if (attr.value) {
      content += `=${attr.startWrapper?.content || ''}${attr.value.content}${attr.endWrapper?.content || ''}`
    }
    return content
      ? [
          {
            ...attr,
            content,
            startPosition: attr.key.startPosition,
            endPosition: (attr.endWrapper || attr.value || attr.key).endPosition,
          },
        ]
      : []
  })
  interface Attribute {
    content: string // 内容
    startPosition: number // 开始位置
    endPosition: number // 结束位置
  }
  return ast as {
    selfClosing: boolean // 是否自闭合标签
    openStart: Attribute // 标签开始
    openEnd: Attribute // 标签结束
    attributes: Attribute[] // 标签属性列表
  }
}

// 判断标签是否单行
export function tagIsSingleLine(
  tagRange = getNowHtmlTagRange()!,
  ast = getHtmlAst(window.activeTextEditor!.document.getText(tagRange))
) {
  const editor = window.activeTextEditor!
  const firstNodePosition = ast.attributes.length ? ast.attributes[0].startPosition : ast.openEnd.startPosition
  const firstNodeLine = editor.document.positionAt(
    editor.document.offsetAt(tagRange.start) + firstNodePosition + 1
  ).line
  return firstNodeLine === tagRange.start.line
}

// 获取光标最近的标签属性
export function getNearHtmlAttr(
  tagRange = getNowHtmlTagRange()!,
  ast = getHtmlAst(window.activeTextEditor!.document.getText(tagRange))
) {
  if (!ast.attributes.length) return
  const editor = window.activeTextEditor!
  const startIndex = editor.document.offsetAt(editor.selection.active) - editor.document.offsetAt(tagRange.start)
  const startOffsets = ast.attributes.map(({ startPosition }) => Math.abs(startIndex - startPosition - 1))
  const endOffsets = ast.attributes.map(({ endPosition }) => Math.abs(startIndex - endPosition))
  const min = Math.min(...startOffsets, ...endOffsets)
  const positionType = startOffsets.includes(min) ? 'start' : 'end'
  return {
    positionType,
    attr: ast.attributes[(positionType === 'start' ? startOffsets : endOffsets).indexOf(min)],
  } as const
}

// 选中光标所在标签的属性
export async function selectHtmlAttr(index?: number) {
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return
  const editor = window.activeTextEditor!
  const ast = getHtmlAst(editor.document.getText(tagRange))
  const attr = (typeof index === 'number' && ast.attributes[index]) || getNearHtmlAttr(tagRange, ast)?.attr
  if (!attr) return
  editor.selection = new Selection(
    positionOffset(tagRange.start, (ast.attributes[ast.attributes.indexOf(attr) - 1] || ast.openStart).endPosition + 1),
    positionOffset(tagRange.start, attr.endPosition + 1)
  )
  await waitSelectionChange()
  return attr
}

// 正则匹配光标最近的匹配项
export function getNearMatch(reg: RegExp) {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const position = editor.selection.active
  const range = new Range(position.line && position.line - 1, 0, position.line + 2, 0)
  const text = editor.document.getText(range)
  const matchs = [...text.matchAll(reg)]
  if (!matchs.length) return
  const startIndex = editor.document.offsetAt(position) - editor.document.offsetAt(range.start)
  const indexs = matchs.map((item) =>
    Math.min(Math.abs(startIndex - item.index), Math.abs(startIndex - item.index - item[0].length))
  )
  const match = matchs[indexs.indexOf(Math.min(...indexs))]
  const startPosition = editor.document.positionAt(editor.document.offsetAt(range.start) + match.index)
  return {
    value: match[0],
    startPosition,
    range: new Range(startPosition, positionOffset(startPosition, match[0].length)),
  }
}

// 获取光标所在括号内的内容ast
export async function getBracketAst() {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const active = editor.selection.active
  await commands.executeCommand('editor.action.selectToBracket')
  if (editor.selection.isEmpty) return
  const text = editor.document.getText(editor.selection)
  if (!['(', '[', '{', '<'].includes(text[0])) return
  if (!text.replace(/^.(.+).$/s, '$1').trim()) {
    return Object.assign([], { active })
  }
  let _text = ''
  let nodes: { pos: number; end: number }[] = []
  const astFn = (newText: string) =>
    // @ts-ignore
    createSourceFile('temp.ts', (_text = newText), ScriptTarget.Latest).statements[0].expression
  if (text[0] === '(') {
    nodes = astFn(text).parameters || astFn(`fn${text}`).arguments
  } else if (text[0] === '[') {
    nodes = astFn(text).elements
  } else if (text[0] === '{') {
    nodes = astFn(`[${text}]`).elements[0].properties
  } else if (text[0] === '<') {
    nodes = astFn(`fn${text}`).typeArguments
  }
  if (!nodes) return
  const startIndex = editor.document.offsetAt(editor.selection.start)
  let currentIndex = 0
  return Object.assign(
    nodes.map((item) => {
      const content = _text.substring(item.pos, item.end).trim()
      const index = text.indexOf(content, currentIndex)
      currentIndex = index + content.length
      return {
        text: content,
        start: editor.document.positionAt(startIndex + index),
        end: editor.document.positionAt(startIndex + currentIndex),
      }
    }),
    { active }
  )
}

// 选中光标所在括号内的属性
export async function selectBracketAttr(index?: number) {
  const nodes = await getBracketAst()
  if (!nodes?.length) return
  const editor = window.activeTextEditor!
  const nearPosition = getNearPosition(
    nodes.active,
    nodes.flatMap(({ start, end }) => [start, end])
  )
  const nearNode =
    (typeof index === 'number' && nodes[index]) ||
    nodes.find(({ start, end }) => nearPosition === start || nearPosition === end)!
  let { start, end } = nearNode
  if (nodes.length === 1) {
    // 只有一个属性
    start = positionOffset(editor.selection.start, 1)
    end = positionOffset(editor.selection.end, -1)
  } else if (nodes.at(-1) === nearNode) {
    // 最后一个属性
    start = nodes[nodes.indexOf(nearNode) - 1].end
    const afterText = editor.document.getText(new Range(nearNode.end, editor.selection.end))
    const offset = afterText.match(/,|;/)
    if (offset) {
      end = positionOffset(nearNode.end, offset.index! + 1)
    }
  } else {
    end = nodes[nodes.indexOf(nearNode) + 1].start
  }
  editor.selection = new Selection(start, end)
  await waitSelectionChange()
  return nearNode
}
