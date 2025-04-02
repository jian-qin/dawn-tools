import { commands, window, Selection, env, Range } from 'vscode'
import { selectionsHistory } from './store'
import {
  getHtmlTagRange,
  filterRangeList,
  getIndentationMode,
  tagIsSingleLine,
  getHtmlAst,
  getNearHtmlAttr,
  selectHtmlAttrs,
  getLineIndent,
  positionOffset,
} from './tools'

// 格式化光标所在标签（切换单行/多行）
commands.registerCommand(
  'dawn-tools.html.format',
  (() => {
    const _fn = (tagRange: Range) => {
      const editor = window.activeTextEditor!
      const ast = getHtmlAst(editor.document.getText(tagRange))
      const end = ast.openEnd.content
      const { tab, br } = getIndentationMode()
      let newTag = ast.openStart.content
      // 格式化标签
      if (tagIsSingleLine(ast)) {
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
      return newTag
    }
    return async () => {
      const editor = window.activeTextEditor
      if (!editor?.selections.length) return
      const tagRanges = filterRangeList(
        editor.selections.map((selection) => getHtmlTagRange(selection.active)).filter(Boolean) as Range[]
      )
      if (!tagRanges.length) return
      editor.selections = tagRanges.map((range) => new Selection(range.start, range.end))
      editor.edit((editBuilder) => tagRanges.forEach((range) => editBuilder.replace(range, _fn(range))))
    }
  })()
)

// 复制光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.copy', async () => {
  const text = html_attr_copy()
  if (!text) return
  env.clipboard.writeText(text)
})
function html_attr_copy() {
  const attrs = selectHtmlAttrs()
  if (!attrs) return
  return attrs
    .map(({ ast, index }) => ast.attributes[index].content)
    .reverse()
    .join(' ')
}

// 删除光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.delete', async () => {
  const attrs = selectHtmlAttrs()
  if (!attrs) return
  commands.executeCommand('deleteLeft')
})

// 粘贴光标所在标签的属性
commands.registerCommand(
  'dawn-tools.html.attr.paste',
  (() => {
    const _fn = ({ tagRange, ast, index, type }: NonNullable<ReturnType<typeof getNearHtmlAttr>>, texts: string[]) => {
      const { tab, br } = getIndentationMode()
      const baseTab = getLineIndent(tagRange.start.line).text
      const isSingleLine = tagIsSingleLine(ast)
      const air = isSingleLine ? ' ' : `${br}${baseTab}${tab}`
      let editOffset: {
        start: number
        end: number
      }
      let text = air + texts.join(air)
      if (type) {
        // 有属性
        const attr = ast.attributes[index]
        if (index === 0 && type === 'start') {
          // 第一个属性
          editOffset = {
            start: ast.openStart.endPosition + 1,
            end: attr.startPosition,
          }
          text = `${text}${air}`
        } else if (index === ast.attributes.length - 1 && type === 'end') {
          // 最后一个属性
          editOffset = {
            start: attr.endPosition + 1,
            end: ast.openEnd.startPosition,
          }
          text = isSingleLine ? `${text}${ast.selfClosing ? ' ' : ''}` : `${text}${br}${baseTab}`
        } else {
          // 中间的属性
          editOffset =
            type === 'start'
              ? {
                  start: ast.attributes[index - 1].endPosition + 1,
                  end: attr.startPosition,
                }
              : {
                  start: attr.endPosition + 1,
                  end: ast.attributes[index + 1].startPosition,
                }
          text = `${text}${air}`
        }
      } else {
        // 无属性
        editOffset = {
          start: ast.openStart.endPosition + 1,
          end: ast.openEnd.startPosition,
        }
        text = isSingleLine ? `${text}${ast.selfClosing ? ' ' : ''}` : `${text}${br}${baseTab}`
      }
      return {
        range: new Range(
          positionOffset(tagRange.start, editOffset.start),
          positionOffset(tagRange.start, editOffset.end)
        ),
        text,
      }
    }
    return async (text?: string) => {
      const editor = window.activeTextEditor
      if (!editor?.selections.length) return
      text ??= (await env.clipboard.readText()).trim()
      if (!text) return
      const attrs = editor.selections.flatMap((selection) => {
        const attr = getNearHtmlAttr(selection.active)
        return attr ? [attr] : []
      })
      if (!attrs.length) return
      const texts = getHtmlAst(`<a ${text}>`).attributes.map((attr) => attr.content)
      const editorDatas = filterRangeList(
        attrs.map((item) => _fn(item, texts)),
        ({ range }) => range
      )
      editor.selections = editorDatas.map(
        ({ range }) => new Selection(range.start, range.isEmpty ? range.end.translate(0, 1) : range.end)
      )
      await editor.edit((editBuilder) => editorDatas.forEach(({ range, text }) => editBuilder.replace(range, text)))
      if (editorDatas.some(({ range }) => range.isEmpty)) {
        editor.selections = editor.selections.map((selection, index) =>
          editorDatas[index].range.isEmpty ? new Selection(selection.start, selection.end.translate(0, -1)) : selection
        )
      }
    }
  })()
)

// 移动上一个光标所在标签的属性到当前光标所在标签
commands.registerCommand('dawn-tools.html.attr.move', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const before = selectionsHistory.at(-2)
  if (!before) return
  const current = selectionsHistory.at(-1)!
  editor.selections = before
  const text = html_attr_copy()
  if (!text) return
  const selections = editor.selections
  editor.selections = current
  await editor.edit((editBuilder) => selections.forEach((selection) => editBuilder.delete(selection)))
  commands.executeCommand('dawn-tools.html.attr.paste', text)
})
