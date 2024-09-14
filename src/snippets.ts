import { commands, window, env, Selection } from 'vscode'

// 插入console.log
commands.registerCommand("dawn-tools.snippets.log", async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  let text = ''
  // text = 选中的字符 || 光标所在位置的单词 || 剪贴板的内容
  editor.selection.isEmpty && await commands.executeCommand('editor.action.addSelectionToNextFindMatch')
  text = editor.selection.isEmpty ? await env.clipboard.readText() : editor.document.getText(editor.selection)
  text = text.trim()
  // 当前行是否为空行
  const isEmptyLine = editor.document.lineAt(editor.selection.start.line).isEmptyOrWhitespace
  if (!isEmptyLine) {
    await commands.executeCommand('editor.action.insertLineAfter')
  }
  await editor.edit(editBuilder => editBuilder.insert(editor.selection.start, `console.log(${text})`))
  const endPosition = editor.selection.start.translate(0, -1)
  editor.selection = new Selection(
    editor.document.positionAt(editor.document.offsetAt(endPosition) - text.length),
    endPosition,
  )
})
