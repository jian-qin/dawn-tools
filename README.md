# Dawn Tool Set

English | [简体中文](./README.zh-CN.md)

> This is a personal toolbox

## File/Folder Right-click Menu

+ `Copy file name` If the file name is index, copy the name of the folder where the file is located

+ `Copy relative path` Copy the path relative to the currently viewed file

+ `Copy absolute path` Copy the absolute path of the file

## Shortcuts

### html

+ `ctrl + shift + a` Formatting the tab where the cursor is located as a multi-line/single line

+ `ctrl + shift + c` Copy the attribute of the tab closest to the cursor in the tab where the cursor is located

+ `ctrl + shift + d` Execute `ctrl + shift + c` and then delete

### js/ts

+ `alt + b` Format the contents of the parentheses ((), [], {}, <>) where the cursor is placed as a multi-line/single line

+ `ctrl + alt + c` Copy the item in parentheses ((), [], {}, <>) where the cursor is located

+ `ctrl + alt + d` Execute `ctrl + alt + c` and then delete

### vue

+ `ctrl + alt + h` The currently viewed vue file, scroll to the `template` block

+ `ctrl + alt + j` The currently viewed vue file, scroll to the `script` block

+ `ctrl + alt + k` The currently viewed vue file, scroll to the `style` block

### Code Snippets

+ `alt + q` Insert `console.log(selected character || word where cursor is located || contents of clipboard)`

+ `alt + w` Insert `console.log (use word from last cursor position)`

### Others

+ `alt + f` Replace the Chinese symbols nearest the cursor (3 lines) with English symbols

+ `alt + g` Replace the English symbols nearest the cursor (3 lines) with Chinese symbols

+ `alt + backspace` Delete the word closest to the cursor (3 lines)

+ `ctrl + shift + v` Special paste, formatted according to clipboard contents

  + If `Copy relative path`, `Copy absolute path` copied content

    + Read 10 lines before and after the cursor, determine the import mode, whether to add a semicolon, whether to add a new line

    + `import filename from 'path'`, `const filename = require('path')`

  + In the case of `ctrl + shift + c`, `ctrl + shift + d` copied content

    + Paste after the attribute closest to the cursor in the tab where the cursor is located

    + Determine whether the label is multi-line/single line, whether to add newlines or not
