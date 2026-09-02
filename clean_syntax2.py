import re

with open('src/pages/StudyTracker.tsx', 'r') as f:
    content = f.read()

# Match the bad block exactly using regex to handle whitespace
pattern1 = r'</div\>\s*</div\>\s*\)\}\s*</div\>\s*\);\s*\}\)\}'
replacement1 = r'''</div>
                          )}
                        </div>
                      );
                    })}'''

content = re.sub(pattern1, replacement1, content)

with open('src/pages/StudyTracker.tsx', 'w') as f:
    f.write(content)
