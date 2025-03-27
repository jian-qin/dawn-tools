import { commands, window, env, Selection, Range } from 'vscode'
import {
  getNearMatchs,
  getIndentationMode,
  positionOffset,
  bracketIsSingleLine,
  getBracketAst,
  selectBracketAttrs,
  selectBracketAttrs_lastExpand,
  getNearPosition,
  getNearBracketAttr,
  getLineIndent,
  filterRangeList,
} from './tools'

// 特殊粘贴
commands.registerCommand('dawn-tools.other.paste', async () => {
  const text = (await env.clipboard.readText()).trim()
  if (text.startsWith('.') || text.startsWith('/')) {
    await commands.executeCommand('dawn-tools.file.copy.path.paste')
  } else {
    await commands.executeCommand('dawn-tools.html.attr.paste')
  }
})

const symbol_map = {
  '·': '`',
  '！': '!',
  '￥': '$',
  '……': '^',
  '（': '(',
  '）': ')',
  '——': '_',
  '【': '[',
  '】': ']',
  '、': '/',
  '；': ';',
  '：': ':',
  '‘': "'",
  '’': "'",
  '“': '"',
  '”': '"',
  '，': ',',
  '《': '<',
  '。': '.',
  '》': '>',
  '？': '?',
}
const symbol_keys = Object.keys(symbol_map)
const symbol_values = Object.values(symbol_map)
const symbol_keys_reg = new RegExp(`(${symbol_keys.join('|')})`, 'g')
const symbol_values_reg = new RegExp(`(${symbol_values.map((val) => '\\' + val).join('|')})`, 'g')

// 替换光标最近的特殊符号
commands.registerCommand('dawn-tools.other.symbol', async (mode: 'toEN' | 'toCN') => {
  const matchs = getNearMatchs(mode === 'toEN' ? symbol_keys_reg : symbol_values_reg)
  if (!matchs) return
  window.activeTextEditor!.edit((editBuilder) =>
    matchs.forEach((match) => {
      const value =
        mode === 'toEN'
          ? symbol_map[match.text as keyof typeof symbol_map]
          : symbol_keys[symbol_values.indexOf(match.text)]
      editBuilder.replace(match.range, value)
    })
  )
})

// 删除光标最近的单词
commands.registerCommand('dawn-tools.other.word.delete', async () => {
  const matchs = getNearMatchs(/\w+/g)
  if (!matchs) return
  const editor = window.activeTextEditor!
  editor.selections = matchs.map(({ range }) => new Selection(range.start, range.start))
  editor.edit((editBuilder) => matchs.forEach(({ range }) => editBuilder.delete(range)))
  env.clipboard.writeText(matchs.map(({ text }) => text).join('\n'))
})

// 删除光标最近的空白字符
commands.registerCommand('dawn-tools.other.gap.delete', async () => {
  const matchs = getNearMatchs(/\s+/g)
  if (!matchs) return
  const editor = window.activeTextEditor!
  editor.selections = matchs.map(({ range }) => new Selection(range.start, range.start))
  editor.edit((editBuilder) => matchs.forEach(({ range }) => editBuilder.delete(range)))
})

// 展开/收起光标所在括号内的内容
commands.registerCommand(
  'dawn-tools.other.bracket',
  (() => {
    const _fn = async (range: Range) => {
      const editor = window.activeTextEditor!
      const text = editor.document.getText(range)
      const ast = getBracketAst(text)
      if (!ast?.nodes.length) return
      const { tab, br } = getIndentationMode()
      let newText = ''
      if (positionOffset(range.start, ast.nodes[0].start).line !== range.start.line) {
        // 换行的缩进-减少
        newText = ast.nodes.map(({ text }) => text.replaceAll(br + tab, br)).join(', ')
        newText = text.at(0) === '{' ? `{ ${newText} }` : `${text.at(0)}${newText}${text.at(-1)}`
      } else {
        // 换行的缩进-增加
        const baseTab = getLineIndent(range.start.line).text
        newText = ast.nodes.map(({ text }) => text.replaceAll(br, br + tab)).join(`,${br}${baseTab}${tab}`)
        newText = `${text.at(0)}${br}${baseTab}${tab}${newText}${br}${baseTab}${text.at(-1)}`
      }
      await editor.edit((editBuilder) => editBuilder.replace(range, newText))
    }
    return async () => {
      const editor = window.activeTextEditor
      if (!editor?.selections.length) return
      await commands.executeCommand('editor.action.selectToBracket')
      const selections = filterRangeList([...editor.selections])
      if (!selections.length) return
      for (const selection of selections) {
        await _fn(selection)
      }
    }
  })()
)

// 复制光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.copy', async () => {
  const attrs = await selectBracketAttrs()
  if (!attrs?.length) return
  selectBracketAttrs_lastExpand(attrs)
  const delimiter = attrs.find(({ ast }) => ast.nodes.length > 1)?.ast.delimiter || ','
  const value = attrs.reduce((text, { attr }) => text + attr.text + delimiter, '')
  env.clipboard.writeText(value)
})

// 删除光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.delete', async () => {
  const attrs = await selectBracketAttrs()
  if (!attrs?.length) return
  selectBracketAttrs_lastExpand(attrs)
  commands.executeCommand('deleteLeft')
})

// 粘贴光标所在括号内的属性
commands.registerCommand(
  'dawn-tools.other.json.paste',
  (() => {
    const _fn = (
      { tagRange, tagText, ast, attr, index, type }: NonNullable<ReturnType<typeof getNearBracketAttr>>,
      texts: string[],
      delimiter: string
    ) => {
      const { tab, br } = getIndentationMode()
      const baseTab = getLineIndent(tagRange.start.line).text
      const isSingleLine = bracketIsSingleLine(ast)
      if (ast.nodes.length > 1) {
        delimiter = ast.delimiter
      }
      delimiter = delimiter.trim()
      if (isSingleLine && !delimiter) {
        delimiter = ','
      }
      const air = delimiter + (isSingleLine ? ' ' : `${br}${baseTab}${tab}`)
      const tagStartAir = isSingleLine ? (tagText[0] === '{' ? ' ' : '') : `${br}${baseTab}${tab}`
      const tagEndAir = isSingleLine ? (tagText[0] === '{' ? ' ' : '') : `${br}${baseTab}`
      let editOffset: {
        start: number
        end: number
      }
      let text = texts.join(air)
      if (attr) {
        // 有属性
        if (index === 0 && type === 'start') {
          // 第一个属性
          editOffset = {
            start: 1,
            end: attr.start,
          }
          text = `${tagStartAir}${text}${air}`
        } else if (index === ast.nodes.length - 1 && type === 'end') {
          // 最后一个属性
          editOffset = {
            start: attr.end,
            end: tagText.length - 1,
          }
          text = `${air}${text}${tagEndAir}`
        } else {
          // 中间的属性
          editOffset =
            type === 'start'
              ? {
                  start: ast.nodes[index - 1].end,
                  end: attr.start,
                }
              : {
                  start: attr.end,
                  end: ast.nodes[index + 1].start,
                }
          text = `${air}${text}${air}`
        }
      } else {
        // 无属性
        editOffset = {
          start: 1,
          end: tagText.length - 1,
        }
        text = `${tagStartAir}${text}${tagEndAir}`
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
      const actives = editor.selections.map(({ active }) => active)
      await commands.executeCommand('editor.action.selectToBracket')
      const positions = editor.selections.flatMap(({ start, end }) => [start, end])
      const attrs = actives.flatMap((active) => {
        const position = getNearPosition(active, positions)
        const selection = editor.selections.find(({ start, end }) => start.isEqual(position) || end.isEqual(position))!
        const attr = getNearBracketAttr(selection, active)
        return attr ? [attr] : []
      })
      if (!attrs.length) return
      const wrap = editor.document.getText(editor.selection)
      const ast = getBracketAst(`${wrap.at(0)}${text}${wrap.at(-1)}`)
      if (!ast) return
      const texts = ast.nodes.map(({ text }) => text)
      const editorDatas = filterRangeList(
        attrs.map((item) => _fn(item, texts, ast.delimiter)),
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
