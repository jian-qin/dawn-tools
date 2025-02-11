import { commands, window, env, Selection } from 'vscode'
import { insertLineIfNotEmpty, formatFilePath, getRootPath, getFileName } from './tools'

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
  // 特殊根目录过滤
  text = text.replace(/^\/src\//, '@/')
  // 文件名转换为变量名（小驼峰）
  const fileName = getFileName(text)?.replace(/\W(\w)/g, (_, $1) => $1.toUpperCase()) || ''
  // 读取光标前后10行，判断导入模式（import/require）
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
  if (mode === 'import') {
    text = `import ${fileName} from '${text}'${endSymbol}`
    startCharacter = 7
  } else {
    text = `const ${fileName} = require('${text}')${endSymbol}`
    startCharacter = 6
  }
  await insertLineIfNotEmpty()
  await editor.edit((editBuilder) => editBuilder.insert(editor.selection.active, text))
  editor.selection = new Selection(
    editor.selection.active.line,
    startCharacter,
    editor.selection.active.line,
    startCharacter + fileName.length
  )
  return text
})
