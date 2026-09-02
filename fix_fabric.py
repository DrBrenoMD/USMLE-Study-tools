with open('src/pages/FlashcardsEditor.tsx', 'r') as f:
    code = f.read()

code = code.replace('import * as fabric from "fabric";', 'import { fabric } from "fabric";')

with open('src/pages/FlashcardsEditor.tsx', 'w') as f:
    f.write(code)
