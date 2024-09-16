import { commands, env } from 'vscode'
import { formatFilePath } from './tools'

// 复制文件名
commands.registerCommand("dawn-tools.file.name.copy", async (file) => {
  const result = formatFilePath(file.path).split('/')
  let name = result.at(-1)?.replace(/(.+)\..*/, '$1')
  // 特殊名称过滤
  if (name === 'index') {
    name = result.at(-2)
  }
  if (!name) return
  await env.clipboard.writeText(name)
  return name
})
