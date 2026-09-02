import re

with open('/tmp/useStudyPlan.ts', 'r') as f:
    content = f.read()

# Modify Case 4 in calculateResourceByDate
# Locate Case 4
target = "        // Caso 4: Material por Quantidade (QBanks, Livros, Vídeos)"
parts = content.split(target)

if len(parts) == 2:
    case4_content = parts[1]
    
    # We want to replace the current math in Case 4 with the new exact-day math.
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
          // Nova lógica exata
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
            const f = r.fixedVolumeByDayOfWeek[d];
            if (f !== undefined && f !== null) {
              totalFixed += f * dowCounts[d];
            } else {
              unfixedCount += dowCounts[d];
            }
          }
          
          const rem = Math.max(0, remainingItems - totalFixed);
          amountPerDay = unfixedCount > 0 ? Math.ceil((rem / unfixedCount) * 10) / 10 : 0;
          
          const daysOfWeekNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          breakdown.push(`Volume total pendente: ${remainingItems} ${r.unit}`);
          
          let totalDaysCount = 0;
          for (let d = 0; d < 7; d++) {
            const f = r.fixedVolumeByDayOfWeek[d];
            if (dowCounts[d] > 0) {
              totalDaysCount += dowCounts[d];
              if (f !== undefined && f !== null) {
                breakdown.push(`${daysOfWeekNames[d]}: ${f} ${r.unit}/dia (Fixo) x ${dowCounts[d]} dias = ${f * dowCounts[d]}`);
              } else {
                breakdown.push(`${daysOfWeekNames[d]}: ${amountPerDay} ${r.unit}/dia (Dinâmico) x ${dowCounts[d]} dias = ${Math.round(amountPerDay * dowCounts[d])}`);
              }
            }
          }
          breakdown.push(`Dias úteis até a data: ${totalDaysCount}`);
          
          const todayDow = startOfDay(new Date()).getDay();
          const todayFixed = r.fixedVolumeByDayOfWeek[todayDow];
          dailyAmountToday = (todayFixed !== undefined && todayFixed !== null) ? todayFixed : amountPerDay;

        } else {
          // Lógica anterior
          amountPerDay = Math.ceil((remainingItems / Math.max(1, allocatedEffectiveDays)) * 10) / 10;
          dailyAmountToday = amountPerDay;
          breakdown.push(`Volume pendente: ${remainingItems} ${r.unit}`);
          breakdown.push(`Dias úteis até o final da fase: ${allocatedEffectiveDays}`);
          breakdown.push(`Cálculo: ${remainingItems} / ${allocatedEffectiveDays} = ${amountPerDay} ${r.unit}/dia`);
        }

        const dailyMinutes = Math.round(dailyAmountToday * (r.minutesPerItem || 2));
"""
    # Replace the portion up to calc object creation
    sub_parts = case4_content.split("const calc: ResourceScheduleCalculation = {")
    
    final_content = parts[0] + new_case4 + "        const calc: ResourceScheduleCalculation = {" + sub_parts[1].replace("dailyAmount: amountPerDay", "dailyAmount: dailyAmountToday").replace("projectedDailyAmount: amountPerDay", "projectedDailyAmount: amountPerDay").replace("scheduleNote: activeNow", "calculationBreakdown: breakdown,\n          scheduleNote: activeNow")
    
    with open('/tmp/useStudyPlan_mod.ts', 'w') as out:
        out.write(final_content)
        
