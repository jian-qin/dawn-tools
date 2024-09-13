import { commands, window, Selection } from 'vscode'
import { getNowHtmlTagRange, getIndentationMode } from './tools'
import { tokenize, constructTree } from 'hyntax'

// 格式化选中html代码片段（自动选中光标所在html）
commands.registerCommand("dawn-tools.html.format", async () => {
  const newRange = getNowHtmlTagRange()
  if (!newRange) return
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(newRange)
  const ast = constructTree(tokenize(tag).tokens).ast.content.children[0].content as any
  console.log(ast)
  let newTag = ast.openStart.content.trim()
  const end = ast.openEnd.content.trim()
  const tab = getIndentationMode().tab
  // 获取属性字符串
  const attrs = ast.attributes.flatMap((attr: any) => {
    let attrStr = attr.key.content
    if (attr.value) {
      attrStr += `=${attr.startWrapper.content}${attr.value.content}${attr.endWrapper.content}`
    }
    attrStr = attrStr.trim()
    return attrStr ? [attrStr] : []
  }) as string[]
  // 判断是否需要换行
  const firstAttr = ast.attributes.find((attr: any) => attr.key.content.trim())
  const firstAttrLine = editor.document.positionAt(editor.document.offsetAt(newRange.start) + firstAttr.key.startPosition + 1).line
  // 格式化标签
  if (firstAttrLine === newRange.start.line) {
    const line = editor.document.lineAt(newRange.start.line)
    const baseTab = line.text.substring(0, line.firstNonWhitespaceCharacterIndex)
    const attrTab = `\n${baseTab}${tab}`
    const attrStr = attrs.map(attr => attr.replaceAll('\n', `\n${tab}`)).join(attrTab)
    newTag += `${attrTab}${attrStr}\n${baseTab}${end}`
  } else {
    const attrStr = attrs.map(attr => attr.replaceAll(`\n${tab}`, '\n')).join(' ')
    newTag += ` ${attrStr}${end[0] === '/' ? ' ' : ''}${end}`
  }
  // 设置新的标签
  await editor.edit(editBuilder => {
    editBuilder.replace(newRange, newTag)
  })
  // 选中新的标签
  editor.selection = new Selection(newRange.start, getNowHtmlTagRange()!.end)
})
