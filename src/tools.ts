import { window, Range, type Position } from 'vscode'
import { parser } from 'posthtml-parser'

// 等待editor.selection修改完成
export function waitSelectionChange() {
  return new Promise<void>(resolve => {
    const { dispose } = window.onDidChangeTextEditorSelection(() => {
      dispose()
      resolve()
    })
  })
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
    const ast = parser(tag)[0]
    if (ast) {
      // 开始标签匹配失败
      if (!isLegalHtmlTag(ast)) return null
      afterIndex = beforeIndex + match.index + 1
      break
    }
  } while (reg.lastIndex < text.length)
  if (!afterIndex) return
  return document.positionAt(afterIndex)
}

// 是否合法的 html 标签
function isLegalHtmlTag(ast: any) {
  const keys = Object.keys(ast.attrs || {})
  // 无属性标签，直接中断操作
  if (!keys.length) return
  // 是否合法的attribute和tag
  const noLegalAttribute = [ast.tag, ...keys].some(key => ['"', "'"].includes(key.at(-1)))
  return !noLegalAttribute
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
