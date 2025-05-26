import { commands, window, env, Selection, Range } from 'vscode'
import { formatFilePath, getRootPath, getFileName, getLineIndent, getIndentationMode } from './tools'

// 复制文件名
commands.registerCommand('dawn-tools.file.copy.name', async (file) => {
  const name = getFileName(file.path)
  if (!name) return
  await env.clipboard.writeText(name)
  return name
})

// 复制相对路径
commands.registerCommand('dawn-tools.file.copy.path.relative', async (file) => {
  const editor = window.activeTextEditor
  if (!editor) return
  const currentPath = formatFilePath(editor.document.uri.path)
  const targetPath = formatFilePath(file.path)
  if (currentPath === targetPath) return
  let currentArr = currentPath.split('/')
  let targetArr = targetPath.split('/')
  currentArr.some((item, index) => {
    if (item !== targetArr[index]) {
      currentArr = currentArr.slice(index)
      targetArr = targetArr.slice(index)
      return true
    }
  })
  let path = ''
  path += currentArr.length === 1 ? './' : '../'.repeat(currentArr.length - 1)
  path += targetArr.join('/')
  await env.clipboard.writeText(path)
  return path
})

// 复制绝对路径
commands.registerCommand('dawn-tools.file.copy.path.absolute', async (file) => {
  const rootPath = getRootPath(file.path)
  let path = formatFilePath(file.path).replace(rootPath, '')
  if (path[0] !== '/') {
    path = '/' + path
  }
  await env.clipboard.writeText(path)
  return path
})

// 粘贴复制的路径
commands.registerCommand('dawn-tools.file.copy.path.paste', async () => {
  const editor = window.activeTextEditor
  if (!editor?.selection) return
  let text = (await env.clipboard.readText()).trim()
  // 文件名转换为变量名（小驼峰）
  const fileName = getFileName(text)?.replace(/\W(\w)/g, (_, $1) => $1.toUpperCase()) || ''
  // 读取光标前后（10行），判断导入模式（import/require）
  let mode = 'import'
  let startCharacter = 7
  let endSymbol = ''
  const offsets = [0, -1, -2, -3, -4, -5, 1, 2, 3, 4, 5]
  const require_reg = /(^|=|;)\s*require\s*\(/
  const import_reg = /(^|;)\s*import(\s|\{|\*|'|"|`)/
  offsets.some((offset) => {
    const line = editor.selection.active.line + offset
    if (line < 0 || line >= editor.document.lineCount) return
    const lineText = editor.document.lineAt(line).text
    if (require_reg.test(lineText)) {
      mode = 'require'
      if (lineText.at(-1) === ';') {
        endSymbol = ';'
      }
      return true
    } else if (import_reg.test(lineText)) {
      mode = 'import'
      if (lineText.at(-1) === ';') {
        endSymbol = ';'
      }
      return true
    }
  })
  // vue项目根目录转换为@
  {
    const reg = /^\/src\//
    const value = '@/'
    const has = () => {
      const offset = editor.selection.active.line
      const min = Math.max(offset + Math.min(...offsets), 0)
      const max = Math.min(offset + Math.max(...offsets), editor.document.lineCount - 1)
      return editor.document.getText(new Range(min, 0, max, 0)).includes(value)
    }
    // 复制的路径是vue文件、或者当前编辑器是vue文件、或者当前文件已经导入过@（光标前后范围查找）
    if (reg.test(text) && (text.endsWith('.vue') || editor.document.languageId === 'vue' || has())) {
      text = text.replace(reg, value)
    }
  }
  if (mode === 'import') {
    text = `import ${fileName} from '${text}'${endSymbol}`
    startCharacter = 7
  } else {
    text = `const ${fileName} = require('${text}')${endSymbol}`
    startCharacter = 6
  }
  if (!editor.document.lineAt(editor.selection.active.line).isEmptyOrWhitespace) {
    await commands.executeCommand('editor.action.insertLineAfter')
  }
  const nextLine = editor.selection.active.line + 1
  if (nextLine < editor.document.lineCount) {
    const { text: lineText, isEmptyOrWhitespace } = editor.document.lineAt(nextLine)
    if (!isEmptyOrWhitespace && !require_reg.test(lineText) && !import_reg.test(lineText)) {
      text += getIndentationMode().br + getLineIndent(nextLine).text
    }
  }
  const { line, character } = editor.selection.active
  await editor.edit((editBuilder) => editBuilder.insert(editor.selection.active, text))
  editor.selection = new Selection(line, character + startCharacter, line, character + startCharacter + fileName.length)
  return text
})
