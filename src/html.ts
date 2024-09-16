import { commands, window, Selection, env } from 'vscode'
import { waitSelectionChange, getNowHtmlTagRange, getIndentationMode, isTagWrap, getHtmlAst, getNearHtmlAttr } from './tools'

// 格式化选中html代码片段（自动选中光标所在html）
commands.registerCommand("dawn-tools.html.format", async () => {
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(tagRange)
  const ast = getHtmlAst(tag)
  let newTag = ast.openStart._content
  const end = ast.openEnd.content
  const tab = getIndentationMode().tab
  // 格式化标签
  if (isTagWrap(tagRange, ast)) {
    if (ast._attributes) {
      const attrStr = ast._attributes.map((attr: any) => attr._assembly.replaceAll(`\n${tab}`, '\n')).join(' ')
      newTag += ` ${attrStr}`
    }
    newTag += `${ast.openEnd._isClose ? ' ' : ''}${end}`
  } else {
    const line = editor.document.lineAt(tagRange.start.line)
    const baseTab = line.text.substring(0, line.firstNonWhitespaceCharacterIndex)
    const attrTab = `\n${baseTab}${tab}`
    if (ast._attributes) {
      const attrStr = ast._attributes.map((attr: any) => attr._assembly.replaceAll('\n', `\n${tab}`)).join(attrTab)
      newTag += `${attrTab}${attrStr}`
    }
    newTag += `\n${baseTab}${end}`
  }
  // 设置新的标签
  await editor.edit(editBuilder => editBuilder.replace(tagRange, newTag))
  // 选中更新的标签
  editor.selection = new Selection(tagRange.start, getNowHtmlTagRange()!.end)
  await waitSelectionChange()
})

// 复制光标所在标签的属性
commands.registerCommand("dawn-tools.html.attr.copy", async () => {
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return false
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(tagRange)
  const attr = getNearHtmlAttr(tagRange)?.attr
  if (!attr) return false
  const beforeGap = tag.substring(0, attr.key.startPosition).match(/\s+$/)?.[0] || ''
  await env.clipboard.writeText(beforeGap + attr._assembly)
  editor.selection = new Selection(
    editor.document.positionAt(editor.document.offsetAt(tagRange.start) + attr.key.startPosition - beforeGap.length),
    editor.document.positionAt(editor.document.offsetAt(tagRange.start) + attr._endPositionTrim + 1)
  )
  return true
})

// 删除光标所在标签的属性
commands.registerCommand("dawn-tools.html.attr.delete", async () => {
  const isCopy = await commands.executeCommand('dawn-tools.html.attr.copy')
  if (!isCopy) return false
  await commands.executeCommand('deleteLeft')
  return true
})

// 粘贴光标所在标签的属性
commands.registerCommand("dawn-tools.html.attr.paste", async () => {
  let text = (await env.clipboard.readText()).trim()
  if (!text) return false
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return false
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(tagRange)
  const ast = getHtmlAst(tag)
  const tab = getIndentationMode().tab
  const getBeforeGap = (position: number) => tag.substring(0, position).match(/\s+$/)?.[0] || ''
  let nodePosition: number
  // 是否有属性
  if (ast._attributes) {
    const { startIndex, attr } = getNearHtmlAttr(tagRange, ast)!
    const beforeGap = getBeforeGap(attr.key.startPosition)
    // 光标更靠近属性名的开始/结束
    if (Math.abs(startIndex - attr.key.startPosition) < Math.abs(startIndex - attr._endPositionTrim)) {
      nodePosition = attr.key.startPosition
      if (isTagWrap(tagRange, ast)) {
        text = `${text}${beforeGap}`
      } else {
        text = `${text} `
      }
    } else {
      nodePosition = attr._endPositionTrim + 1
      if (isTagWrap(tagRange, ast)) {
        text = `${beforeGap}${text}`
      } else {
        if (ast.openEnd._isClose) {
          text = tag[attr._endPositionTrim + 1] === ' ' ? ` ${text}` : ` ${text} `
        } else {
          text = ` ${text}`
        }
      }
    }
  } else {
    nodePosition = ast.openEnd.startPosition
    if (isTagWrap(tagRange, ast)) {
      const beforeGap = getBeforeGap(nodePosition)
      text = `${tab}${text}${beforeGap}`
    } else {
      if (ast.openEnd._isClose) {
        text = tag[nodePosition - 1] === ' ' ? `${text} ` : ` ${text} `
      } else {
        text = ` ${text}`
      }
    }
  }
  const newTag = `${tag.substring(0, nodePosition)}${text}${tag.substring(nodePosition)}`
  await editor.edit(editBuilder => editBuilder.replace(tagRange, newTag))
  editor.selection = new Selection(
    editor.document.positionAt(editor.document.offsetAt(tagRange.start) + nodePosition),
    editor.document.positionAt(editor.document.offsetAt(tagRange.start) + nodePosition + text.length)
  )
})
