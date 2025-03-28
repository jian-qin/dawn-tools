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

// 范围列表过滤重复项、倒序排序
export function filterRangeList<T extends any[]>(ranges: T, get = (range: T[number]): Range => range) {
  const offsetAt = window.activeTextEditor!.document.offsetAt
  return ranges
    .reduce<any[]>((prev, range) => {
      prev.some((range2) => get(range).isEqual(get(range2))) || prev.push(range)
      return prev
    }, [])
    .sort((a, b) => offsetAt(get(b).start) - offsetAt(get(a).start)) as T
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

// 获取标签整体范围
export function getHtmlTagRange(position: Position) {
  // 循环匹配标签位置
  let beforePosition: ReturnType<typeof getHtmlStartIndex>
  let afterPosition: ReturnType<typeof getHtmlEndIndex>
  do {
    beforePosition = getHtmlStartIndex(position)
    if (!beforePosition) return
    afterPosition = getHtmlEndIndex(beforePosition)
    if (afterPosition) break
    position = beforePosition
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
  ast.tag = tag
  interface Attribute {
    content: string // 内容
    startPosition: number // 开始位置
    endPosition: number // 结束位置
  }
  return ast as {
    tag: string // 标签名
    selfClosing: boolean // 是否自闭合标签
    openStart: Attribute // 标签开始
    openEnd: Attribute // 标签结束
    attributes: Attribute[] // 标签属性列表
  }
}

// 判断标签是否单行
export function tagIsSingleLine(ast: ReturnType<typeof getHtmlAst>) {
  const start = ast.openStart.endPosition + 1
  const end = ast.attributes.length ? ast.attributes[0].startPosition : ast.openEnd.startPosition
  return !/\r|\n/.test(ast.tag.slice(start, end))
}

// 获取光标最近的标签属性
export function getNearHtmlAttr(position: Position) {
  const tagRange = getHtmlTagRange(position)
  if (!tagRange) return
  const editor = window.activeTextEditor!
  const tagText = editor.document.getText(tagRange)
  const ast = getHtmlAst(tagText)
  if (!ast.attributes.length) {
    return { tagRange, tagText, ast } as const
  }
  const startIndex = editor.document.offsetAt(position) - editor.document.offsetAt(tagRange.start)
  const startOffsets = ast.attributes.map(({ startPosition }) => Math.abs(startIndex - startPosition - 1))
  const endOffsets = ast.attributes.map(({ endPosition }) => Math.abs(startIndex - endPosition))
  const min = Math.min(...startOffsets, ...endOffsets)
  const type = startOffsets.includes(min) ? 'start' : 'end'
  const index = (type === 'start' ? startOffsets : endOffsets).indexOf(min)
  const attrRange = new Range(
    positionOffset(tagRange.start, (ast.attributes[index - 1] || ast.openStart).endPosition + 1),
    positionOffset(tagRange.start, ast.attributes[index].endPosition + 1)
  )
  return {
    tagRange,
    tagText,
    type,
    index,
    ast,
    attr: ast.attributes[index],
    attrRange,
  } as const
}

// 选中光标所在标签的属性
export function selectHtmlAttrs() {
  const selections = window.activeTextEditor?.selections || []
  if (!selections.length) return
  let attrs = selections.flatMap((selection) => {
    const attr = getNearHtmlAttr(selection.active)
    return attr?.attr ? [attr] : []
  })
  if (!attrs.length) return
  attrs = filterRangeList(attrs, ({ attrRange }) => attrRange)
  window.activeTextEditor!.selections = attrs.map(({ attrRange }) => new Selection(attrRange.start, attrRange.end))
  return attrs
}

// 正则匹配光标最近的匹配项
export function getNearMatchs(reg: RegExp) {
  const editor = window.activeTextEditor
  if (!editor?.selections.length) return
  const results = [...editor.document.getText().matchAll(reg)].map((item) => ({
    text: item[0],
    start: item.index,
    end: item.index + item[0].length,
  }))
  if (!results.length) return
  return editor.selections.map(({ active }) => {
    const index = editor.document.offsetAt(active)
    const offsets = results.flatMap(({ start, end }) => [Math.abs(index - start), Math.abs(index - end)])
    const min = results[Math.floor(offsets.indexOf(Math.min(...offsets)) / 2)]
    return {
      text: min.text,
      range: new Range(editor.document.positionAt(min.start), editor.document.positionAt(min.end)),
    }
  })
}

// 获取光标所在括号内的内容ast
export function getBracketAst(text: string) {
  if (!['(', '[', '{', '<'].includes(text[0])) return
  let delimiter = ','
  if (!text.replace(/^.(.+).$/s, '$1').trim()) {
    return { text, delimiter, nodes: [] }
  }
  let _text = ''
  let _nodes: { pos: number; end: number }[] = []
  const astFn = (newText: string) =>
    // @ts-ignore
    createSourceFile('temp.ts', (_text = newText), ScriptTarget.Latest).statements[0].expression
  if (text[0] === '(') {
    _nodes = astFn(text).parameters || astFn(`fn${text}`).arguments
  } else if (text[0] === '[') {
    _nodes = astFn(text).elements
  } else if (text[0] === '{') {
    _nodes = astFn(`[${text}]`).elements[0].properties
  } else if (text[0] === '<') {
    _nodes = astFn(`fn${text}`).typeArguments
  }
  if (!_nodes) return
  let end = 0
  const nodes = _nodes.map((item) => {
    const content = _text.substring(item.pos, item.end).trim()
    const start = text.indexOf(content, end)
    end = start + content.length
    return {
      text: content,
      start,
      end,
    }
  })
  if (nodes.length) {
    delimiter = text.slice(nodes[0].end).match(/^\s*(\S)/)![1]
    if (![',', ';'].includes(delimiter)) {
      delimiter = ''
    }
    delimiter ||= nodes.length === 1 ? ',' : getIndentationMode().br
  }
  return { text, delimiter, nodes }
}

// 判断括号是否单行
export function bracketIsSingleLine(ast: NonNullable<ReturnType<typeof getBracketAst>>) {
  const end = ast.nodes.length ? ast.nodes[0].start : ast.text.length - 1
  return !/\r|\n/.test(ast.text.slice(1, end))
}

// 获取光标所在括号内的属性
export function getNearBracketAttr(tagRange: Range, position: Position) {
  const editor = window.activeTextEditor!
  const tagText = editor.document.getText(tagRange)
  const ast = getBracketAst(tagText)
  if (!ast) return
  if (!ast.nodes.length) {
    return { tagRange, tagText, ast } as const
  }
  const startIndex = editor.document.offsetAt(position) - editor.document.offsetAt(tagRange.start)
  const startOffsets = ast.nodes.map(({ start }) => Math.abs(startIndex - start))
  const endOffsets = ast.nodes.map(({ end }) => Math.abs(startIndex - end))
  const min = Math.min(...startOffsets, ...endOffsets)
  const type = startOffsets.includes(min) ? 'start' : 'end'
  const index = (type === 'start' ? startOffsets : endOffsets).indexOf(min)
  const attr = ast.nodes[index]
  const attrRange = new Range(
    positionOffset(tagRange.start, attr.start),
    positionOffset(
      tagRange.start,
      index === ast.nodes.length - 1 ? tagText.match(/(?<=\S)\s*.$/)!.index! : ast.nodes[index + 1].start
    )
  )
  return {
    tagRange,
    tagText,
    type,
    index,
    ast,
    attr,
    attrRange,
  } as const
}

// 选中光标所在括号内的属性
export async function selectBracketAttrs() {
  const editor = window.activeTextEditor
  if (!editor) return
  const actives = editor.selections.map(({ active }) => active)
  if (!actives.length) return
  await commands.executeCommand('editor.action.selectToBracket')
  const positions = editor.selections.flatMap(({ start, end }) => [start, end])
  let attrs = actives.flatMap((active) => {
    const position = getNearPosition(active, positions)
    const selection = editor.selections.find(({ start, end }) => start.isEqual(position) || end.isEqual(position))!
    const attr = getNearBracketAttr(selection, active)
    return attr?.attr ? [attr] : []
  })
  if (!attrs.length) return
  attrs = filterRangeList(attrs, ({ attrRange }) => attrRange).reverse()
  editor.selections = attrs.map(({ attrRange }) => new Selection(attrRange.start, attrRange.end))
  return attrs
}

// 选中光标所在括号内的属性-最后一个元素扩选前面的空格
export function selectBracketAttrs_lastExpand(attrs: Awaited<ReturnType<typeof selectBracketAttrs>>) {
  if (!attrs?.length) return
  let indexs = attrs.flatMap(({ index, ast }, i) => (ast.nodes.length > 1 && ast.nodes.length - 1 === index ? [i] : []))
  const getFirstIndex = (_index: number) => {
    const firstIndex = attrs.findIndex(
      ({ tagRange, index }) => tagRange.isEqual(attrs[_index].tagRange) && index === attrs[_index].index - 1
    )
    if (firstIndex === -1) {
      return _index
    }
    if (attrs[firstIndex].index === 0) {
      return -1
    }
    return getFirstIndex(firstIndex)
  }
  indexs = indexs.flatMap((index) => {
    const _index = getFirstIndex(index)
    return _index === -1 ? [] : [_index]
  })
  if (indexs.length) {
    window.activeTextEditor!.selections = attrs.map(({ attrRange, tagRange }, index) => {
      let start = attrRange.start
      if (indexs.includes(index)) {
        start = positionOffset(tagRange.start, attrs[index].ast.nodes[attrs[index].index - 1].end)
      }
      return new Selection(start, attrRange.end)
    })
  }
}
