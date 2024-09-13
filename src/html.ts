import { commands, window, Selection, env } from 'vscode'
import { getNowHtmlTagRange, getIndentationMode, getHtmlAst } from './tools'

// 格式化选中html代码片段（自动选中光标所在html）
commands.registerCommand("dawn-tools.html.format", async () => {
  const newRange = getNowHtmlTagRange()
  if (!newRange) return
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(newRange)
  const ast = getHtmlAst(tag)
  let newTag = ast.openStart._content
  const end = ast.openEnd._content
  const tab = getIndentationMode().tab
  // 判断是否需要换行
  const firstAttr = ast.attributes.find((attr: any) => attr.key.content.trim())
  const firstAttrLine = editor.document.positionAt(editor.document.offsetAt(newRange.start) + firstAttr.key.startPosition + 1).line
  // 格式化标签
  if (firstAttrLine === newRange.start.line) {
    const line = editor.document.lineAt(newRange.start.line)
    const baseTab = line.text.substring(0, line.firstNonWhitespaceCharacterIndex)
    const attrTab = `\n${baseTab}${tab}`
    const attrStr = ast._attributes.map((attr: any) => attr._assembly.replaceAll('\n', `\n${tab}`)).join(attrTab)
    newTag += `${attrTab}${attrStr}\n${baseTab}${end}`
  } else {
    const attrStr = ast._attributes.map((attr: any) => attr._assembly.replaceAll(`\n${tab}`, '\n')).join(' ')
    newTag += ` ${attrStr}${end[0] === '/' ? ' ' : ''}${end}`
  }
  // 设置新的标签
  await editor.edit(editBuilder => {
    editBuilder.replace(newRange, newTag)
  })
  // 选中新的标签
  editor.selection = new Selection(newRange.start, getNowHtmlTagRange()!.end)
})

// 复制光标所在标签的属性
commands.registerCommand("dawn-tools.html.attr.copy", async () => {
  const newRange = getNowHtmlTagRange()
  if (!newRange) return
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(newRange)
  const ast = getHtmlAst(tag)
  const startIndex = editor.document.offsetAt(editor.selection.start) - editor.document.offsetAt(newRange.start)
  const offsets: number[] = ast._attributes.map((attr: any) => Math.min(
    Math.abs(startIndex - attr.key.startPosition),
    Math.abs(startIndex - attr._endPosition),
  ))
  const attr = ast._attributes[offsets.indexOf(Math.min(...offsets))]
  const beforeGap = tag.substring(0, attr.key.startPosition).match(/\s+$/)![0]
  env.clipboard.writeText(beforeGap + attr._assembly)
  editor.selection = new Selection(
    editor.document.positionAt(editor.document.offsetAt(newRange.start) + attr.key.startPosition - beforeGap.length),
    editor.document.positionAt(editor.document.offsetAt(newRange.start) + attr._endPosition + 1)
  )
  return true
})

// 删除光标所在标签的属性
commands.registerCommand("dawn-tools.html.attr.delete", async () => {
  const isCopy = await commands.executeCommand('dawn-tools.html.attr.copy')
  if (!isCopy) return
  await commands.executeCommand('deleteLeft')
  return true
})
