with open('src/hooks/useStudyPlan.ts', 'r') as f:
    code = f.read()

target1 = """          projectedDailyAmount: dailyMinutes,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: `${dailyMinutes} min/dia contínuos`,
        };"""
replace1 = """          projectedDailyAmount: dailyMinutes,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: `${dailyMinutes} min/dia contínuos`,
          calculationBreakdown: [`Tempo fixo configurado: ${dailyMinutes} min/dia`],
        };"""
if target1 in code:
    code = code.replace(target1, replace1)

target2 = """          projectedDailyAmount: pace,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow
            ? `${pace} ${r.unit}/dia (~${dailyMinutes} min/dia) • Término em ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto para iniciar em ${format(startDate, 'dd/MM/yyyy')} com ${pace} ${r.unit}/dia até ${format(endDate, 'dd/MM/yyyy')}`,
        };"""
replace2 = """          projectedDailyAmount: pace,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow
            ? `${pace} ${r.unit}/dia (~${dailyMinutes} min/dia) • Término em ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto para iniciar em ${format(startDate, 'dd/MM/yyyy')} com ${pace} ${r.unit}/dia até ${format(endDate, 'dd/MM/yyyy')}`,
          calculationBreakdown: [`Volume pendente: ${remainingItems} ${r.unit}`, `Ritmo (Pace) configurado: ${pace} ${r.unit}/dia`, `Cálculo de dias: ${remainingItems} / ${pace} = ${daysNeeded} dias necessários`],
        };"""
if target2 in code:
    code = code.replace(target2, replace2)

with open('src/hooks/useStudyPlan.ts', 'w') as f:
    f.write(code)
