import { commands, window, Selection, env, Range } from 'vscode'
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
    const _fn = async (tagRange: Range) => {
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
      // 设置新的标签
      await editor.edit((editBuilder) => editBuilder.replace(tagRange, newTag))
    }
    return async () => {
      const selections = window.activeTextEditor?.selections || []
      if (!selections.length) return
      const tagRanges = filterRangeList(
        selections.map((selection) => getHtmlTagRange(selection.active)).filter(Boolean) as Range[]
      )
      if (!tagRanges.length) return
      window.activeTextEditor!.selections = tagRanges.map((range) => new Selection(range.start, range.end))
      for (const range of tagRanges) {
        await _fn(range)
      }
    }
  })()
)

// 复制光标所在标签的属性
commands.registerCommand('dawn-tools.html.attr.copy', async () => {
  const attrs = selectHtmlAttrs()
  if (!attrs) return
  env.clipboard.writeText(
    attrs
      .map(({ ast, index }) => ast.attributes[index].content)
      .reverse()
      .join(' ')
  )
})

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
    const _fn = (
      { tagRange, ast, attr, index, type }: NonNullable<ReturnType<typeof getNearHtmlAttr>>,
      texts: string[]
    ) => {
      const { tab, br } = getIndentationMode()
      const baseTab = getLineIndent(tagRange.start.line).text
      const isSingleLine = tagIsSingleLine(ast)
      const air = isSingleLine ? ' ' : `${br}${baseTab}${tab}`
      let editOffset: {
        start: number
        end: number
      }
      let text = air + texts.join(air)
      if (attr) {
        // 有属性
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
    return async () => {
      const editor = window.activeTextEditor
      if (!editor?.selections.length) return
      const text = (await env.clipboard.readText()).trim()
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
      for (const { range, text } of editorDatas) {
        await editor.edit((editBuilder) => editBuilder.replace(range, text))
      }
      if (editorDatas.some(({ range }) => range.isEmpty)) {
        editor.selections = editor.selections.map((selection, index) =>
          editorDatas[index].range.isEmpty ? new Selection(selection.start, selection.end.translate(0, -1)) : selection
        )
      }
    }
  })()
)
