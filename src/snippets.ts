import { commands, window, env, Selection } from 'vscode'
import { getIndentationMode, getLineIndent, positionOffset } from './tools'
import { selectionsHistory } from './store'

// 插入console.log(选中的字符 || 光标所在位置的单词 || 剪贴板的内容)
commands.registerCommand('dawn-tools.snippets.log', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selections.length) return
  // 剪贴板的内容
  await commands.executeCommand('editor.action.addSelectionToNextFindMatch')
  const inserts = editor.selections.filter(({ isEmpty }) => isEmpty)
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
  }
  editor.selections = editor.selections.filter(({ isEmpty }) => !isEmpty)
  // 选中的字符 || 光标所在位置的单词
  const texts = editor.selections.map((selection) => {
    const text = editor.document.getText(selection)
    const quote = text.includes("'") ? (text.includes('"') ? '`' : '"') : "'"
    return `console.log(${quote}${text}${quote}, ${text})`
  })
  await commands.executeCommand('editor.action.insertLineAfter')
  await editor.edit((editBuilder) => {
    editor.selections.forEach(({ active }, index) => editBuilder.insert(active, texts[index]))
  })
})

// 插入console.log - 使用上一次光标位置的单词
commands.registerCommand('dawn-tools.snippets.log.before', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const before = selectionsHistory.at(-2)
  if (!before) return
  const current = selectionsHistory.at(-1)!
  editor.selections = before
  await commands.executeCommand('editor.action.addSelectionToNextFindMatch')
  const texts = editor.selections.flatMap((selection) => {
    if (selection.isEmpty) {
      return []
    }
    const text = editor.document.getText(selection)
    const quote = text.includes("'") ? (text.includes('"') ? '`' : '"') : "'"
    return [`console.log(${quote}${text}${quote}, ${text})`]
  })
  editor.selections = current
  if (!editor.document.lineAt(editor.selection.active.line).isEmptyOrWhitespace) {
    await commands.executeCommand('editor.action.insertLineAfter')
  }
  await editor.edit((editBuilder) => {
    const gap = getIndentationMode().br + getLineIndent(editor.selection.active.line).text
    editBuilder.insert(editor.selection.active, texts.join(gap))
  })
})
