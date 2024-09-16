import { window, Range, Position, workspace } from 'vscode'
import { parser } from 'posthtml-parser'
import { tokenize, constructTree } from 'hyntax'

// 等待editor.selection修改完成
export function waitSelectionChange() {
  return new Promise<void>(resolve => {
    const { dispose } = window.onDidChangeTextEditorSelection(() => {
      dispose()
      resolve()
    })
  })
}

// 格式化文件路径（统一斜杠、大小写盘符、去除盘符前的斜杠）
export function formatFilePath(path: string) {
  return path.replace(/\\/g, '/').replace(/^\/([a-z]:)/, '$1').replace(/^[a-z]:/, $0 => $0.toUpperCase())
}

// 获取文件对应的根目录
export function getRootPath(path: string) {
  path = formatFilePath(path)
  const roots = workspace.workspaceFolders!.map(root => formatFilePath(root.uri.path))
  return roots.find(root => path.startsWith(root))!
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
export function getIndentationMode () {
  const editor = window.activeTextEditor!
  const indentMode = editor.options.insertSpaces!
  const tabSize = editor.options.tabSize!
  return {
    mode: indentMode ? 'space' : 'tab',
    size: tabSize,
    tab: indentMode ? ' '.repeat(Number(tabSize)) : '\t',
  }
}

// 获取选中区域中间位置坐标
export function getRangeMiddlePosition () {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const { start, end } = editor.selection
  const startIndex = editor.document.offsetAt(start)
  const endIndex = editor.document.offsetAt(end)
  if (startIndex === endIndex) return start
  const index = Math.floor((startIndex + endIndex) / 2)
  return editor.document.positionAt(index)
}

// 获取标签开始位置的下标
export function getHtmlStartIndex(position: Position) {
  if (!position) return
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
    if (!ast[0]?.tag) return null
    afterIndex = beforeIndex + match.index + 1
    break
  } while (reg.lastIndex < text.length)
  if (!afterIndex) return
  return document.positionAt(afterIndex)
}

// 获取光标所在的标签位置
export function getNowHtmlTagRange() {
  const nowPosition = getRangeMiddlePosition()
  if (!nowPosition) return
  // 循环获取标签位置
  let forIndex = nowPosition
  let beforePosition, afterPosition
  do {
    beforePosition = getHtmlStartIndex(forIndex)
    if (!beforePosition) return
    afterPosition = getHtmlEndIndex(beforePosition)
    if (afterPosition === null) {
      forIndex = module.exports.positionAddMinus(beforePosition, -1)
      continue
    } else if (!afterPosition) {
      return
    }
    break
  } while (true)
  return new Range(beforePosition, afterPosition)
}

// 获取html标签的ast语法树
export function getHtmlAst(tag: string) {
  const ast: any = constructTree(tokenize(tag).tokens).ast.content.children[0].content
  ast.openStart._content = ast.openStart.content.trimEnd()
  ast.openEnd._isClose = ast.openEnd.content[0] === '/'
  if (ast.attributes) {
    ast._attributes = ast.attributes.flatMap((attr: any) => {
      let _assembly = attr.key.content
      if (attr.value) {
        _assembly += `=${attr.startWrapper?.content || ''}${attr.value.content}${attr.endWrapper?.content || ''}`
      }
      const len = _assembly.length
      _assembly = _assembly.trimEnd()
      const offset = len - _assembly.length
      const _endPosition = (attr.endWrapper || attr.value || attr.key).endPosition
      const _endPositionTrim = _endPosition - offset
      return _assembly ? [{
        ...attr,
        _assembly,
        _endPosition,
        _endPositionTrim,
      }] : []
    })
    if (ast._attributes.length === 0) {
      delete ast._attributes
    }
  }
  return ast
}

// 判断标签是否换行
export function isTagWrap(
  tagRange = getNowHtmlTagRange()!,
  ast: any = getHtmlAst(window.activeTextEditor!.document.getText(tagRange))
) {
  const editor = window.activeTextEditor!
  const firstNodePosition = ast._attributes ? ast._attributes[0].key.startPosition : ast.openEnd.startPosition
  const firstNodeLine = editor.document.positionAt(editor.document.offsetAt(tagRange.start) + firstNodePosition + 1).line
  return firstNodeLine !== tagRange.start.line
}

// 获取光标最近的标签属性
export function getNearHtmlAttr(
  tagRange = getNowHtmlTagRange()!,
  ast: any = getHtmlAst(window.activeTextEditor!.document.getText(tagRange))
) {
  if (!ast._attributes) return
  const editor = window.activeTextEditor!
  const startIndex = editor.document.offsetAt(editor.selection.start) - editor.document.offsetAt(tagRange.start)
  const offsets: number[] = ast._attributes.map((attr: any) => Math.min(
    Math.abs(startIndex - attr.key.startPosition),
    Math.abs(startIndex - attr._endPositionTrim),
  ))
  return {
    startIndex,
    attr: ast._attributes[offsets.indexOf(Math.min(...offsets))],
  }
}
