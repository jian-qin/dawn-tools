import { commands, window, Range, TextEditorRevealType } from 'vscode'

// 滚动到指定标签
commands.registerCommand('dawn-tools.vue.scrollTo', async (type: string) => {
  const editor = window.activeTextEditor
  if (!editor) return
  const reg = new RegExp(`^\\s*<${type}[^>]*>`)
  const line = editor.document
    .getText()
    .split('\n')
    .findIndex((line) => reg.test(line))
  if (line === -1) return
  const lineOffset = line + 5
  editor.revealRange(new Range(lineOffset, 0, lineOffset, 0), TextEditorRevealType.AtTop)
  return line
})
