with open('src/hooks/useStudyPlan.ts', 'r') as f:
    code = f.read()

# Make the changes required for `calculationBreakdown` in DailySchedule
code = code.replace("note: item.scheduleNote || '',", "note: item.scheduleNote || '',\n              calculationBreakdown: item.calculationBreakdown,")
code = code.replace("projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,", "projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,\n              calculationBreakdown: item.calculationBreakdown,")
code = code.replace("note: 'Material 100% concluído!',", "note: 'Material 100% concluído!',\n              calculationBreakdown: item.calculationBreakdown,")
code = code.replace("note: item.scheduleNote || 'Sessão periódica agendada',", "note: item.scheduleNote || 'Sessão periódica agendada',\n            calculationBreakdown: item.calculationBreakdown,")


old_case4 = """        // Caso 4: Material por Quantidade (QBanks, Livros, Vídeos)
        // Dias de estudo brutos e efetivos disponíveis a partir do startDate
        const totalStudyDaysFromStart = Math.max(1, countStudyDays(startDate, targetFinishDate));
        const effectiveStudyDaysFromStart = Math.max(1, Math.round(
          totalStudyDaysFromStart * (effectiveDailyStudyDays / Math.max(1, totalStudyDays))
        ));

        const selfWork = getResourceWorkMinutes(r);
        const downstreamWork = getDownstreamWorkMinutes(r.id);
        const children = childrenMap.get(r.id) || [];

        let allocatedEffectiveDays = effectiveStudyDaysFromStart;
        let endDate = targetFinishDate;

        // Se houver sucessores na cadeia com trabalho pendente, divide os dias proporcionalmente
        if (children.length > 0 && downstreamWork > 0 && selfWork > 0) {
          const fraction = Math.min(1, Math.max(0.05, selfWork / downstreamWork));
          allocatedEffectiveDays = Math.max(1, Math.round(effectiveStudyDaysFromStart * fraction));
          const rawStudyDays = Math.max(1, Math.round(totalStudyDaysFromStart * fraction));
          endDate = findDateAfterStudyDays(startDate, rawStudyDays);
        }

        const amountPerDay = Math.ceil((remainingItems / Math.max(1, allocatedEffectiveDays)) * 10) / 10;
        const dailyMinutes = Math.round(amountPerDay * (r.minutesPerItem || 2));

        const calc: ResourceScheduleCalculation = {"""

new_case4 = """        // Caso 4: Material por Quantidade (QBanks, Livros, Vídeos)
        const totalStudyDaysFromStart = Math.max(1, countStudyDays(startDate, targetFinishDate));
        const effectiveStudyDaysFromStart = Math.max(1, Math.round(
          totalStudyDaysFromStart * (effectiveDailyStudyDays / Math.max(1, totalStudyDays))
        ));

        const selfWork = getResourceWorkMinutes(r);
        const downstreamWork = getDownstreamWorkMinutes(r.id);
        const children = childrenMap.get(r.id) || [];

        let allocatedEffectiveDays = effectiveStudyDaysFromStart;
        let endDate = targetFinishDate;
        if (children.length > 0 && downstreamWork > 0 && selfWork > 0) {
          const fraction = Math.min(1, Math.max(0.05, selfWork / downstreamWork));
          allocatedEffectiveDays = Math.max(1, Math.round(effectiveStudyDaysFromStart * fraction));
          const rawStudyDays = Math.max(1, Math.round(totalStudyDaysFromStart * fraction));
          endDate = findDateAfterStudyDays(startDate, rawStudyDays);
        }

        let amountPerDay = 0;
        let breakdown: string[] = [];
        let dailyAmountToday = 0;

        if (r.fixedVolumeByDayOfWeek && Object.keys(r.fixedVolumeByDayOfWeek).length > 0) {
          let cur = startOfDay(startDate);
          const end = startOfDay(endDate);
          const dowCounts = [0,0,0,0,0,0,0];
          while (cur <= end) {
            if (!isDayOff(cur)) {
              dowCounts[cur.getDay()]++;
            }
            cur = addDays(cur, 1);
          }
          
          let totalFixed = 0;
          let unfixedCount = 0;
          for (let d = 0; d < 7; d++) {
            const f = (r.fixedVolumeByDayOfWeek as any)[d];
            if (f !== undefined && f !== null) {
              totalFixed += f * dowCounts[d];
            } else {
              unfixedCount += dowCounts[d];
            }
          }
          
          const rem = Math.max(0, remainingItems - totalFixed);
          amountPerDay = unfixedCount > 0 ? Math.ceil((rem / unfixedCount) * 10) / 10 : 0;
          
          const daysOfWeekNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          breakdown.push(`Volume pendente: ${remainingItems} ${r.unit}`);
          
          let totalDaysCount = 0;
          for (let d = 0; d < 7; d++) {
            const f = (r.fixedVolumeByDayOfWeek as any)[d];
            if (dowCounts[d] > 0) {
              totalDaysCount += dowCounts[d];
              if (f !== undefined && f !== null) {
                breakdown.push(`${daysOfWeekNames[d]}: ${f} ${r.unit}/dia (Fixo) x ${dowCounts[d]} dias`);
              } else {
                breakdown.push(`${daysOfWeekNames[d]}: ${amountPerDay} ${r.unit}/dia (Dinâmico) x ${dowCounts[d]} dias`);
              }
            }
          }
          breakdown.push(`Dias úteis até a data: ${totalDaysCount}`);
          
          const todayDow = startOfDay(new Date()).getDay();
          const todayFixed = (r.fixedVolumeByDayOfWeek as any)[todayDow];
          dailyAmountToday = (todayFixed !== undefined && todayFixed !== null) ? todayFixed : amountPerDay;
        } else {
          amountPerDay = Math.ceil((remainingItems / Math.max(1, allocatedEffectiveDays)) * 10) / 10;
          dailyAmountToday = amountPerDay;
          breakdown.push(`Volume pendente: ${remainingItems} ${r.unit}`);
          breakdown.push(`Dias úteis até o final da fase: ${allocatedEffectiveDays}`);
          breakdown.push(`Cálculo: ${remainingItems} / ${allocatedEffectiveDays} = ${amountPerDay} ${r.unit}/dia`);
        }

        const dailyMinutes = Math.round(dailyAmountToday * (r.minutesPerItem || 2));
        const calc: ResourceScheduleCalculation = {"""

if old_case4 in code:
    code = code.replace(old_case4, new_case4)
    code = code.replace("dailyAmount: amountPerDay,", "dailyAmount: dailyAmountToday,")
    code = code.replace("projectedDailyAmount: amountPerDay,", "projectedDailyAmount: amountPerDay,")
    
    # We only want to replace the FIRST occurrence in Case 4 of `scheduleNote:`
    code = code.replace("scheduleNote: activeNow\n             ?", "calculationBreakdown: breakdown,\n          scheduleNote: activeNow\n             ?")

with open('src/hooks/useStudyPlan.ts', 'w') as f:
    f.write(code)

