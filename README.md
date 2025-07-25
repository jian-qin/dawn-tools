# Dawn Tool Set

English | [简体中文](./README.zh-CN.md)

> This is a personal toolbox

## File/Folder Right-click Menu

- `Copy file name` If the file name is index, copy the name of the folder where the file is located

- `Copy relative path` Copy the path relative to the currently viewed file

- `Copy absolute path` Copy the absolute path of the file

## Shortcuts

### html

- `ctrl + shift + a` Formatting the tab where the cursor is located as a multi-line/single line

- `ctrl + shift + c` Copy the attribute of the tab closest to the cursor in the tab where the cursor is located

- `ctrl + shift + d` Delete the attribute of the tab closest to the cursor in the tab where the cursor is located

- `ctrl + shift + x` Move the attributes of the previous cursor's tab to the current cursor's tab

- `ctrl + shift + alt + o` Toggles the label the cursor is on to a self-closing label

### js/ts

- `alt + b` Format the contents of the parentheses ((), [], {}, <>) where the cursor is placed as a multi-line/single line

- `ctrl + alt + c` Copy the item in parentheses ((), [], {}, <>) where the cursor is located

- `ctrl + alt + d` Delete the item in parentheses ((), [], {}, <>) where the cursor is located

- `ctrl + alt + v` Paste after the attribute closest to the cursor in the parentheses where the cursor is located

- `ctrl + alt + x` Move the item in the parentheses where the cursor was last placed to the parentheses where the cursor is currently placed

- `ctrl + alt + [` Select the content in the parentheses ((), [], {}, <>) where the cursor is located

- `ctrl + alt + ]` Select the upper-level parentheses ((), [], {}, <>) where the cursor is located

### vue

- `ctrl + alt + h` The currently viewed vue file, scroll to the `template` block

- `ctrl + alt + j` The currently viewed vue file, scroll to the `script` block

- `ctrl + alt + k` The currently viewed vue file, scroll to the `style` block

### Code Snippets

- `alt + q` Insert `console.log(selected character || word where cursor is located || contents of clipboard)`

- `alt + w` Insert `console.log (use word from last cursor position)`

### Others

- `alt + f` Replace the Chinese symbols nearest the cursor with English symbols

- `alt + g` Replace the English symbols nearest the cursor with Chinese symbols

- `shift + alt + v` Paste the word as a hump

- `alt + backspace` Delete the word closest to the cursor

- `alt + delete` Delete the whitespace closest to the cursor

- `ctrl + shift + v` Special paste, formatted according to clipboard contents

  - If `Copy relative path`, `Copy absolute path` copied content

    - Read before and after the cursor (10 lines), determine the import mode, whether to add a semicolon, whether to add a newline, and whether to replace the @ symbol for vue items

    - `import filename from 'path'`, `const filename = require('path')`

  - In the case of `ctrl + shift + c`, `ctrl + shift + d` copied content

    - Paste after the attribute closest to the cursor in the tab where the cursor is located

    - Determine whether the label is multi-line/single line, whether to add newlines or not
