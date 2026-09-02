import re

with open('/tmp/useStudyPlan_mod.ts', 'r') as f:
    content = f.read()

content = content.replace("note: item.scheduleNote || '',", "note: item.scheduleNote || '',\n              calculationBreakdown: item.calculationBreakdown,")
content = content.replace("projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,", "projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,\n              calculationBreakdown: item.calculationBreakdown,")
content = content.replace("note: 'Material 100% concluído!',", "note: 'Material 100% concluído!',\n              calculationBreakdown: item.calculationBreakdown,")

with open('/tmp/useStudyPlan_mod.ts', 'w') as out:
    out.write(content)
