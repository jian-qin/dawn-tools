import { commands, window, env, Selection } from 'vscode'
import { getNearMatchs, getIndentationMode, getLineIndent, positionOffset } from './tools'
import { selectionsHistory } from './store'

// 插入console.log(选中的字符 || 光标所在位置的单词 || 剪贴板的内容)
commands.registerCommand('dawn-tools.snippets.log', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  // 剪贴板的内容
  {
    const matchs = getNearMatchs(/\w+/g)
    if (!matchs) return
    const indexs: number[] = []
    const inserts = editor.selections.filter(({ isEmpty, active }, index) => {
      const has = isEmpty && matchs.every(({ range }) => !range.contains(active))
      has || indexs.push(index)
      return has
    })
    if (inserts.length) {
      const text = (await env.clipboard.readText()).trim()
      await editor.edit((editBuilder) => {
        inserts.forEach(({ active }) => editBuilder.insert(active, `console.log(${text})`))
      })
      if (inserts.length === editor.selections.length) {
        editor.selections = inserts.map(
          ({ active }) => new Selection(positionOffset(active, 12), positionOffset(active, 12 + text.length))
        )
        return
      }
      editor.selections = editor.selections.filter((_, index) => indexs.includes(index))
    }
  }
  // 选中的字符 || 光标所在位置的单词
  const texts = snippets_log__getSelectionAndWhereTexts()
  if (!texts.length) return
  await commands.executeCommand('editor.action.insertLineAfter')
  await editor.edit((editBuilder) => {
    editor.selections.forEach(({ active }, index) => editBuilder.insert(active, texts[index]))
  })
})
function snippets_log__getSelectionAndWhereTexts() {
  const editor = window.activeTextEditor!
  const matchs = getNearMatchs(/\w+/g)
  if (!matchs) {
    return []
  }
  return editor.selections.map((selection) => {
    const range = selection.isEmpty ? matchs.find(({ range }) => range.contains(selection.active))?.range : selection
    if (!range) {
      return ''
    }
    const text = editor.document.getText(range)
    const quote = text.includes("'") ? (text.includes('"') ? '`' : '"') : "'"
    return `console.log(${quote}${text}${quote}, ${text})`
  })
}

// 插入console.log - 使用上一次光标位置的单词
commands.registerCommand('dawn-tools.snippets.log.before', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const before = selectionsHistory.at(-2)
  if (!before) return
  const current = selectionsHistory.at(-1)!
  editor.selections = before
  const texts = snippets_log__getSelectionAndWhereTexts().filter(Boolean)
  editor.selections = current
  if (!texts.length) return
  if (!editor.document.lineAt(editor.selection.active.line).isEmptyOrWhitespace) {
    await commands.executeCommand('editor.action.insertLineAfter')
  }
  await editor.edit((editBuilder) => {
    const gap = getIndentationMode().br + getLineIndent(editor.selection.active.line).text
    editBuilder.insert(editor.selection.active, texts.join(gap))
  })
})
