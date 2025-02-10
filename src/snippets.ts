import { commands, window, env, Selection } from 'vscode'
import { insertLineIfNotEmpty, waitSelectionChange } from './tools'
import { selectionsHistory } from './store'

// 插入console.log
commands.registerCommand("dawn-tools.snippets.log", async (editSelection?: Selection) => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  let text = ''
  // text = 选中的字符 || 光标所在位置的单词 || 剪贴板的内容
  editor.selection.isEmpty && await commands.executeCommand('editor.action.addSelectionToNextFindMatch')
  text = editor.selection.isEmpty ? await env.clipboard.readText() : editor.document.getText(editor.selection)
  text = text.trim()
  // 插入位置是否指定
  if (editSelection) {
    editor.selection = editSelection
    await waitSelectionChange()
  }
  await insertLineIfNotEmpty()
  await editor.edit(editBuilder => editBuilder.insert(editor.selection.active, `console.log(${text})`))
  const endPosition = editor.selection.active.translate(0, -1)
  editor.selection = new Selection(
    editor.document.positionAt(editor.document.offsetAt(endPosition) - text.length),
    endPosition,
  )
})

// 插入console.log - 使用上一次光标位置的单词
commands.registerCommand("dawn-tools.snippets.log.before", async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  const beforeSelection = selectionsHistory.at(-2)?.[0]
  if (!beforeSelection) return
  const currentSelection = selectionsHistory.at(-1)![0]
  editor.selection = beforeSelection
  await waitSelectionChange()
  await commands.executeCommand('dawn-tools.snippets.log', currentSelection)
})
