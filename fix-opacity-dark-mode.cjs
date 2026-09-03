const fs = require('fs');
const path = require('path');

function fixInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    const replacements = [
        { from: /bg-white\/80/g, to: 'bg-white/80 dark:bg-gray-800/80' },
        { from: /bg-white\/60/g, to: 'bg-white/60 dark:bg-gray-800/60' },
        { from: /bg-white\/50/g, to: 'bg-white/50 dark:bg-gray-800/50' },
        
        { from: /bg-gray-50\/50/g, to: 'bg-gray-50/50 dark:bg-gray-900' },
        
        { from: /border-gray-200\/80/g, to: 'border-gray-200/80 dark:border-gray-700/80' },
        { from: /border-gray-200\/90/g, to: 'border-gray-200/90 dark:border-gray-700/90' },
        { from: /border-gray-200\/60/g, to: 'border-gray-200/60 dark:border-gray-700/60' },
    ];

    let newContent = content;
    replacements.forEach(r => {
        newContent = newContent.replace(r.from, r.to);
    });

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Fixed opacity classes in ${filePath}`);
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
