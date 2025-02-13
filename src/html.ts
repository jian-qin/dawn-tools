import { commands, window, Selection, env, Range } from 'vscode'
import {
  waitSelectionChange,
  getNowHtmlTagRange,
  getIndentationMode,
  tagIsSingleLine,
  getHtmlAst,
  getNearHtmlAttr,
  selectHtmlAttr,
  getLineIndent,
  positionOffset,
} from './tools'

// 格式化选中html代码片段（自动选中光标所在html）
commands.registerCommand('dawn-tools.html.format', async () => {
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return
  const editor = window.activeTextEditor!
  const tag = editor.document.getText(tagRange)
  const ast = getHtmlAst(tag)
  let newTag = ast.openStart.content
  const end = ast.openEnd.content
  const { tab, br } = getIndentationMode()
  // 格式化标签
  if (tagIsSingleLine(tagRange, ast)) {
    const baseTab = getLineIndent(tagRange.start.line).text
    const attrTab = `${br}${baseTab}${tab}`
    if (ast.attributes.length) {
      // 属性值中的缩进-增加
      const attrStr = ast.attributes.map((attr) => attr.content.replaceAll(br, br + tab)).join(attrTab)
      newTag += `${attrTab}${attrStr}`
    }
    newTag += `${br}${baseTab}${end}`
  } else {
    if (ast.attributes.length) {
      // 属性值中的缩进-减少
      const attrStr = ast.attributes.map((attr) => attr.content.replaceAll(br + tab, br)).join(' ')
      newTag += ` ${attrStr}`
    }
    newTag += `${ast.selfClosing ? ' ' : ''}${end}`
  }
  // 设置新的标签
  await editor.edit((editBuilder) => editBuilder.replace(tagRange, newTag))
  // 选中更新的标签
  editor.selection = new Selection(tagRange.start, getNowHtmlTagRange()!.end)
  await waitSelectionChange()
})

// 复制光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.copy', async (index?: number) => {
  const attr = await selectHtmlAttr(index)
  if (!attr) return
  await env.clipboard.writeText(attr.content)
  return attr
})

// 删除光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.delete', async (index?: number) => {
  const attr = await commands.executeCommand('dawn-tools.html.attr.copy', index)
  if (!attr) return
  await commands.executeCommand('deleteLeft')
  return attr
})

// 粘贴光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.paste', async () => {
  let text = (await env.clipboard.readText()).trim()
  if (!text) return
  const tagRange = getNowHtmlTagRange()
  if (!tagRange) return
  const editor = window.activeTextEditor!
  const ast = getHtmlAst(editor.document.getText(tagRange))
  const { tab, br } = getIndentationMode()
  const baseTab = getLineIndent(tagRange.start.line).text
  const isSingleLine = tagIsSingleLine(tagRange, ast)
  let editOffset: {
    start: number
    end: number
  }
  let newIndex = 0
  if (ast.attributes.length) {
    const { attr, positionType } = getNearHtmlAttr(tagRange, ast)!
    newIndex = ast.attributes.indexOf(attr) + (positionType === 'start' ? 0 : 1)
    // 有属性
    if (ast.attributes[0] === attr && positionType === 'start') {
      // 第一个属性
      editOffset = {
        start: ast.openStart.endPosition + 1,
        end: attr.startPosition,
      }
      text = isSingleLine ? ` ${text} ` : `${br}${baseTab}${tab}${text}${br}${baseTab}${tab}`
    } else if (ast.attributes.at(-1) === attr && positionType === 'end') {
      // 最后一个属性
      editOffset = {
        start: attr.endPosition + 1,
        end: ast.openEnd.startPosition,
      }
      text = isSingleLine ? ` ${text}${ast.selfClosing ? ' ' : ''}` : `${br}${baseTab}${tab}${text}${br}${baseTab}`
    } else {
      // 中间的属性
      editOffset =
        positionType === 'start'
          ? {
              start: ast.attributes[ast.attributes.indexOf(attr) - 1].endPosition + 1,
              end: attr.startPosition,
            }
          : {
              start: attr.endPosition + 1,
              end: ast.attributes[ast.attributes.indexOf(attr) + 1].startPosition,
            }
      text = isSingleLine ? ` ${text} ` : `${br}${baseTab}${tab}${text}${br}${baseTab}${tab}`
    }
  } else {
    // 无属性
    editOffset = {
      start: ast.openStart.endPosition + 1,
      end: ast.openEnd.startPosition,
    }
    text = isSingleLine ? ` ${text}${ast.selfClosing ? ' ' : ''}` : `${br}${baseTab}${tab}${text}${br}${baseTab}`
  }
  await editor.edit((editBuilder) =>
    editBuilder.replace(
      new Range(positionOffset(tagRange.start, editOffset.start), positionOffset(tagRange.start, editOffset.end)),
      text
    )
  )
  return selectHtmlAttr(newIndex)
})
