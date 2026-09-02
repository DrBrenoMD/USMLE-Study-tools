import re

with open('src/hooks/useStudyPlan.ts', 'r') as f:
    code = f.read()

target = r'''          projectedDailyAmount: amountPerDay,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow 
            ? `${amountPerDay} ${r.unit}/dia (~${dailyMinutes} min/dia) até ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')} • ${amountPerDay} ${r.unit}/dia (${dailyMinutes} min/dia)`,
        };'''

replacement = r'''          projectedDailyAmount: amountPerDay,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow 
            ? `${amountPerDay} ${r.unit}/dia (~${dailyMinutes} min/dia) até ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')} • ${amountPerDay} ${r.unit}/dia (${dailyMinutes} min/dia)`,
          calculationBreakdown: breakdown,
        };'''

if target in code:
    with open('src/hooks/useStudyPlan.ts', 'w') as f:
        f.write(code.replace(target, replacement))
    print("Success by date")
else:
    print("Target 1 not found")

target2 = r'''            projectedDailyAmount: dailyMinutes,
            projectedDailyMinutes: dailyMinutes,
            scheduleNote: `Tempo fixo configurado: ${dailyMinutes} min/dia`,
          };'''

replacement2 = r'''            projectedDailyAmount: dailyMinutes,
            projectedDailyMinutes: dailyMinutes,
            scheduleNote: `Tempo fixo configurado: ${dailyMinutes} min/dia`,
            calculationBreakdown: breakdown,
          };'''

code2 = open('src/hooks/useStudyPlan.ts').read()
if target2 in code2:
    with open('src/hooks/useStudyPlan.ts', 'w') as f:
        f.write(code2.replace(target2, replacement2))
    print("Success fixed time")
else:
    print("Target 2 not found")
