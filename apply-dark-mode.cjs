const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const replacements = [
        { from: /bg-white\b(?!\/|\s+dark:)/g, to: 'bg-white dark:bg-gray-900' },
        { from: /bg-gray-50\b(?!\/|\s+dark:)/g, to: 'bg-gray-50 dark:bg-gray-800/50' },
        { from: /bg-gray-100\b(?!\/|\s+dark:)/g, to: 'bg-gray-100 dark:bg-gray-800' },
        { from: /bg-gray-200\b(?!\/|\s+dark:)/g, to: 'bg-gray-200 dark:bg-gray-700' },
        { from: /bg-gray-900\b(?!\/|\s+dark:)/g, to: 'bg-gray-900 dark:bg-gray-50' },
        
        { from: /border-gray-200\b(?!\/|\s+dark:)/g, to: 'border-gray-200 dark:border-gray-700' },
        { from: /border-gray-100\b(?!\/|\s+dark:)/g, to: 'border-gray-100 dark:border-gray-800' },
        { from: /border-gray-300\b(?!\/|\s+dark:)/g, to: 'border-gray-300 dark:border-gray-600' },
        
        { from: /text-gray-900\b(?!\/|\s+dark:)/g, to: 'text-gray-900 dark:text-gray-100' },
        { from: /text-gray-800\b(?!\/|\s+dark:)/g, to: 'text-gray-800 dark:text-gray-200' },
        { from: /text-gray-700\b(?!\/|\s+dark:)/g, to: 'text-gray-700 dark:text-gray-300' },
        { from: /text-gray-600\b(?!\/|\s+dark:)/g, to: 'text-gray-600 dark:text-gray-400' },
        { from: /text-gray-500\b(?!\/|\s+dark:)/g, to: 'text-gray-500 dark:text-gray-400' },
        { from: /text-gray-400\b(?!\/|\s+dark:)/g, to: 'text-gray-400 dark:text-gray-500' },
        
        { from: /text-blue-600\b(?!\/|\s+dark:)/g, to: 'text-blue-600 dark:text-blue-400' },
        { from: /text-blue-700\b(?!\/|\s+dark:)/g, to: 'text-blue-700 dark:text-blue-300' },
        { from: /text-blue-800\b(?!\/|\s+dark:)/g, to: 'text-blue-800 dark:text-blue-200' },
        { from: /bg-blue-50\b(?!\/|\s+dark:)/g, to: 'bg-blue-50 dark:bg-blue-900/30' },
        { from: /bg-blue-100\b(?!\/|\s+dark:)/g, to: 'bg-blue-100 dark:bg-blue-900/50' },
        { from: /bg-blue-600\b(?!\/|\s+dark:)/g, to: 'bg-blue-600 dark:bg-blue-500' },
        
        { from: /hover:bg-gray-50\b(?!\/|\s+dark:)/g, to: 'hover:bg-gray-50 dark:hover:bg-gray-800' },
        { from: /hover:bg-gray-100\b(?!\/|\s+dark:)/g, to: 'hover:bg-gray-100 dark:hover:bg-gray-700' },
        { from: /hover:text-blue-600\b(?!\/|\s+dark:)/g, to: 'hover:text-blue-600 dark:hover:text-blue-400' },
        { from: /hover:text-gray-900\b(?!\/|\s+dark:)/g, to: 'hover:text-gray-900 dark:hover:text-gray-100' },
        { from: /hover:text-gray-700\b(?!\/|\s+dark:)/g, to: 'hover:text-gray-700 dark:hover:text-gray-300' },
    ];

    let newContent = content;
    replacements.forEach(r => {
        newContent = newContent.replace(r.from, r.to);
    });

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function walkSync(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkSync(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            replaceInFile(fullPath);
        }
    });
}

walkSync(path.join(__dirname, 'src'));
