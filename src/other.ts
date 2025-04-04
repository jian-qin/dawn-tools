import { commands, window, env, Selection, Range } from 'vscode'
import { selectionsHistory } from './store'
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

// 以驼峰方式粘贴单词
commands.registerCommand('dawn-tools.other.word.paste.hump', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  let value = (await env.clipboard.readText()).trim()
  if (!value) return
  const matchs = getNearMatchs(/\w+/g)
  if (!matchs) return
  value = value.replace(/^./, (val) => val.toUpperCase())
  editor.edit((editBuilder) =>
    editor.selections.forEach((selection, index) => {
      let { range, text } = matchs[index]
      if (!range.contains(selection)) return
      const base = editor.document.offsetAt(range.start)
      const start = editor.document.offsetAt(selection.start)
      const end = editor.document.offsetAt(selection.end)
      text = text
        .replace(
          new RegExp(`^(.{${start - base}}).{${end - start}}(.?)`),
          (_, $1: string, $2: string) => $1 + value + $2.toUpperCase()
        )
        .replace(/^./, (val) => val.toLowerCase())
      editBuilder.replace(range, text)
    })
  )
  editor.selections = editor.selections.map(({ start }) => new Selection(start, start))
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
    const _fn = (range: Range) => {
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
      return newText
    }
    return async () => {
      const editor = window.activeTextEditor
      if (!editor?.selection) return
      await commands.executeCommand('editor.action.selectToBracket')
      const selections = filterRangeList([...editor.selections])
      if (!selections.length) return
      editor.edit((editBuilder) =>
        selections.forEach((selection) => {
          const text = _fn(selection)
          text && editBuilder.replace(selection, text)
        })
      )
    }
  })()
)

// 复制光标所在括号内的属性
commands.registerCommand('dawn-tools.other.json.copy', async () => {
  const text = await other_json_copy()
  if (!text) return
  env.clipboard.writeText(text)
})
async function other_json_copy() {
  const attrs = await selectBracketAttrs()
  if (!attrs?.length) return
  selectBracketAttrs_lastExpand(attrs)
  const delimiter = attrs.find(({ ast }) => ast.nodes.length > 1)?.ast.delimiter || ','
  return attrs.reduce((text, { ast, index }) => text + ast.nodes[index].text + delimiter, '')
}

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
      { tagRange, tagText, ast, index, type }: NonNullable<ReturnType<typeof getNearBracketAttr>>,
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
      if (type) {
        // 有属性
        const attr = ast.nodes[index]
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
    return async (text?: string) => {
      const editor = window.activeTextEditor
      if (!editor?.selection) return
      text ??= (await env.clipboard.readText()).trim()
      if (!text) return
      let actives = editor.selections.map(({ active }) => active)
      await commands.executeCommand('editor.action.selectToBracket')
      actives = actives.filter((active) =>
        editor.selections.some((selection) => !selection.isEmpty && selection.contains(active))
      )
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
      await editor.edit((editBuilder) => editorDatas.forEach(({ range, text }) => editBuilder.replace(range, text)))
      if (editorDatas.some(({ range }) => range.isEmpty)) {
        editor.selections = editor.selections.map((selection, index) =>
          editorDatas[index].range.isEmpty ? new Selection(selection.start, selection.end.translate(0, -1)) : selection
        )
      }
    }
  })()
)

// 移动上一个光标所在括号的属性到当前光标所在括号
commands.registerCommand('dawn-tools.other.json.move', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const before = selectionsHistory.at(-2)
  if (!before) return
  const current = selectionsHistory.at(-1)!
  editor.selections = before
  const text = await other_json_copy()
  if (!text) return
  const selections = editor.selections
  editor.selections = current
  await editor.edit((editBuilder) => selections.forEach((selection) => editBuilder.delete(selection)))
  commands.executeCommand('dawn-tools.other.json.paste', text)
})
