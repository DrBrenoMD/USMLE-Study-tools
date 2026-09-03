const fs = require('fs');
const path = require('path');

function fixInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const replacements = [
        // Fix double darks caused by chained replacements
        { from: /dark:bg-gray-900 dark:bg-gray-50/g, to: 'dark:bg-gray-900' },
        { from: /dark:text-gray-400 dark:text-gray-500/g, to: 'dark:text-gray-400' },
        { from: /dark:text-gray-300 dark:text-gray-400/g, to: 'dark:text-gray-300' },
        { from: /dark:text-gray-500 dark:text-gray-400/g, to: 'dark:text-gray-500' },
        { from: /dark:bg-gray-800\/50 dark:bg-gray-800/g, to: 'dark:bg-gray-800/50' },
        { from: /dark:border-gray-800 dark:border-gray-700/g, to: 'dark:border-gray-800' },
        { from: /dark:bg-gray-900\/30 dark:bg-gray-900/g, to: 'dark:bg-gray-900/30' },
        { from: /dark:bg-gray-900\/50 dark:bg-gray-900/g, to: 'dark:bg-gray-900/50' },
        // Remove duplicate dark: classes
        { from: /(dark:[-a-z0-9\/]+)\s+\1/g, to: '$1' }
    ];

    let newContent = content;
    replacements.forEach(r => {
        newContent = newContent.replace(r.from, r.to);
    });

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed ${filePath}`);
    }
}

function walkSync(dir) {
    fs.readdirSync(dir).forEach(file => {
        let fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            walkSync(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            fixInFile(fullPath);
        }
    });
}

walkSync(path.join(__dirname, 'src'));
