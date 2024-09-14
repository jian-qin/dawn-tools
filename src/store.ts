import { window, Selection } from 'vscode'

// 保存选中区域历史记录
export const selectionsHistory: Array<readonly Selection[]> = []
window.onDidChangeTextEditorSelection((event) => {
  selectionsHistory.push(event.selections)
  selectionsHistory.length > 5 && selectionsHistory.shift()
})
