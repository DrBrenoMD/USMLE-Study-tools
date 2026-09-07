import { useMemo } from 'react';
import {
  startOfDay,
  addDays,
  subDays,
  differenceInCalendarDays,
  isBefore,
  isSameDay,
  format,
} from 'date-fns';
import {
  Resource,
  StudyPlan,
  StudyMode,
  ResourceScheduleCalculation,
  DailySchedule,
  FrequencyType
} from '../types';

export function useStudyPlan(
  resources: Resource[],
  examDateStr: string,
  daysOff: number[], // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  mode: StudyMode = 'by_date',
  bufferDays: number = 14,
  specificDaysOff: string[] = [] // Array of 'yyyy-MM-dd' dates
): StudyPlan {
  return useMemo(() => {
    const today = startOfDay(new Date());
    const validBuffer = Math.max(0, bufferDays || 0);

    const invalidPlan: StudyPlan = {
      totalDays: 0,
      studyDays: 0,
      effectiveDailyStudyDays: 0,
      totalExclusiveDays: 0,
      estimatedEndDate: null,
      targetFinishDate: null,
      examDate: null,
      bufferDays: validBuffer,
      resourcesSchedule: [],
      dailyTasks: [],
      totalDailyMinutes: 0,
      fixedTimeboxMinutes: 0,
      variableContentMinutes: 0,
      isValid: false,
    };

    if (!resources || resources.length === 0) {
      return { ...invalidPlan, message: "Adicione ao menos um material de estudo para gerar o cronograma." };
    }

    const isDayOff = (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return daysOff.includes(date.getDay()) || specificDaysOff.includes(dateStr);
    };

    // Gera datas periódicas respeitando os dias de folga
    const generatePeriodicDates = (startDate: Date, frequency: FrequencyType, sessions: number, preferredDow?: number): Date[] => {
      let dates: Date[] = [];
      if (sessions <= 0) return dates;
      
      let step = 7;
      if (frequency === 'biweekly') step = 14;
      else if (frequency === 'monthly') step = 28;
      else if (frequency === 'sporadic') step = 21; 

      // Define target day, default is 6 (Saturday), but if Saturday is a day off, find a valid day
      let targetDow = preferredDow ?? 6;
      let fallbackDow = targetDow;
      
      // If the preferred/target day is generally an off day (e.g. they selected Saturday but Saturday is in daysOff)
      // we need to find another day in the week that isn't. Let's step backwards.
      if (daysOff.includes(targetDow)) {
        for (let i = 1; i <= 6; i++) {
          let check = (targetDow - i + 7) % 7;
          if (!daysOff.includes(check)) {
            fallbackDow = check;
            break;
          }
        }
      }

      let cur = startOfDay(startDate);
      // Advance to the nearest day matching fallbackDow
      while (cur.getDay() !== fallbackDow) {
        cur = addDays(cur, 1);
      }
      
      for (let i = 0; i < sessions; i++) {
        // Before pushing, ensure this specific date is not a specific off day.
        // If it is, shift backward by 1 day until valid.
        let actualDate = new Date(cur);
        let safeCounter = 0;
        while (isDayOff(actualDate) && safeCounter < 7) {
          actualDate = subDays(actualDate, 1);
          safeCounter++;
        }
        dates.push(actualDate);
        cur = addDays(cur, step);
      }
      return dates;
    };

    // Conta quantos dias de estudo (não-folga) existem no intervalo [startDate, endDate]
    const countStudyDays = (startDate: Date, endDate: Date, customDaysOfWeek?: number[]): number => {
      if (isBefore(endDate, startDate)) return 0;
      let count = 0;
      let cur = startOfDay(startDate);
      const end = startOfDay(endDate);

      while (cur <= end) {
        if (!isDayOff(cur)) {
          if (!customDaysOfWeek || customDaysOfWeek.length === 0 || customDaysOfWeek.includes(cur.getDay())) {
            count++;
          }
        }
        cur = addDays(cur, 1);
      }
      return count;
    };

    // Encontra a data após N dias de estudo a partir de startDate
    const findDateAfterStudyDays = (startDate: Date, neededStudyDays: number, customDaysOfWeek?: number[]): Date => {
      if (neededStudyDays <= 0) return startDate;
      let cur = startOfDay(startDate);
      let foundDays = 0;

      while (foundDays < neededStudyDays) {
        if (!isDayOff(cur)) {
          if (!customDaysOfWeek || customDaysOfWeek.length === 0 || customDaysOfWeek.includes(cur.getDay())) {
            foundDays++;
          }
        }
        if (foundDays >= neededStudyDays) {
          break;
        }
        cur = addDays(cur, 1);
      }
      return cur;
    };

    // Mapa de recursos por ID
    const resourceMap = new Map<string, Resource>();
    resources.forEach(r => resourceMap.set(r.id, r));

    // Verificação de ciclos de dependência
    const hasCycle = (startId: string): boolean => {
      const visited = new Set<string>();
      let cur: string | null | undefined = startId;
      while (cur) {
        if (visited.has(cur)) return true;
        visited.add(cur);
        const res = resourceMap.get(cur);
        cur = res?.dependsOnId;
      }
      return false;
    };

    for (const r of resources) {
      if (r.dependsOnId && hasCycle(r.id)) {
        return {
          ...invalidPlan,
          message: `Existe uma dependência circular envolvendo o material "${r.name || 'Sem nome'}".`,
        };
      }
    }

    // Mapear relação pai -> filhos
    const childrenMap = new Map<string, Resource[]>();
    resources.forEach(r => {
      if (r.dependsOnId) {
        const list = childrenMap.get(r.dependsOnId) || [];
        list.push(r);
        childrenMap.set(r.dependsOnId, list);
      }
    });

    // ==========================================
    // MODO 1: POR DATA ALVO (BY_DATE)
    // ==========================================
    if (mode === 'by_date') {
      if (!examDateStr) {
        return { ...invalidPlan, message: "Selecione a data da prova para calcular o plano." };
      }

      const examDate = startOfDay(new Date(examDateStr));
      const targetFinishDate = subDays(examDate, validBuffer);
      const totalDaysToFinish = differenceInCalendarDays(targetFinishDate, today);

      if (differenceInCalendarDays(examDate, today) <= 0) {
        return { ...invalidPlan, message: "A data da prova deve ser no futuro." };
      }

      if (totalDaysToFinish <= 0) {
        return {
          ...invalidPlan,
          message: `Com a margem de segurança de ${validBuffer} dia(s), a data limite de término (${format(targetFinishDate, 'dd/MM/yyyy')}) já foi atingida. Reduza a margem ou adie a prova.`,
        };
      }

      const totalStudyDays = countStudyDays(today, targetFinishDate);
      if (totalStudyDays === 0) {
        return {
          ...invalidPlan,
          message: "Não há dias de estudo disponíveis antes do prazo final com as folgas selecionadas.",
        };
      }

      // Calcular dias exclusivos de simulados + correção
      let totalExclusiveDays = 0;
      resources.forEach(r => {
        if (r.frequency !== 'daily') {
          const isExclusive = r.exclusiveStudyDay ?? (r.type === 'nbme');
          if (isExclusive) {
            const rem = Math.max(0, r.total - r.completed);
            const sessions = rem > 0 ? rem : (r.completed >= r.total ? 0 : 1);
            if (sessions > 0) {
              const reviewDays = r.reviewDaysPerItem !== undefined ? r.reviewDaysPerItem : (r.type === 'nbme' ? 1 : 0);
              const daysPerSession = 1 + reviewDays;
              totalExclusiveDays += sessions * daysPerSession;
            }
          }
        }
      });

      // Dias de estudo efetivos para matérias de rotina
      const effectiveDailyStudyDays = Math.max(1, totalStudyDays - totalExclusiveDays);

      // Minutos de trabalho pendentes de um recurso
      const getResourceWorkMinutes = (r: Resource): number => {
        if (r.frequency !== 'daily') return 0;
        const rem = Math.max(0, r.total - r.completed);
        if (rem <= 0 && r.allocationMode !== 'fixed_time') return 0;

        if (r.allocationMode === 'fixed_time') {
          return (r.fixedDailyMinutes || 45) * 30;
        }
        return rem * (r.minutesPerItem || 2);
      };

      // Trabalho total pendente deste recurso e de todos os seus sucessores na cadeia
      const getDownstreamWorkMinutes = (resId: string): number => {
        const res = resourceMap.get(resId);
        if (!res) return 0;
        let work = getResourceWorkMinutes(res);
        const children = childrenMap.get(resId) || [];
        for (const child of children) {
          work += getDownstreamWorkMinutes(child.id);
        }
        return work;
      };

      // Cálculo recursivo respeitando ordem topológica
      const calculatedMap = new Map<string, ResourceScheduleCalculation>();

      const calculateResourceByDate = (r: Resource): ResourceScheduleCalculation => {
        if (calculatedMap.has(r.id)) {
          return calculatedMap.get(r.id)!;
        }

        const isCompleted = (r.total > 0 && r.completed >= r.total);
        const remainingItems = Math.max(0, r.total - r.completed);

        let startDate = today;
        let waitingForName: string | undefined = undefined;
        let activeNow = true;

        if (r.dependsOnId && resourceMap.has(r.dependsOnId)) {
          const parentRes = resourceMap.get(r.dependsOnId)!;
          const parentCalc = calculateResourceByDate(parentRes);
          waitingForName = parentCalc.resourceName;

          // Se o pai já está 100% concluído, a dependência está liberada e o filho inicia HOJE!
          if (parentCalc.isCompleted || parentRes.completed >= parentRes.total) {
            startDate = today;
            activeNow = true;
          } else {
            // Se o pai ainda não concluiu, o filho inicia no dia seguinte ao término previsto do pai
            startDate = addDays(parentCalc.endDate, 1);
            activeNow = differenceInCalendarDays(startDate, today) <= 0;
          }
        }

        if (r.targetStartDate) {
          const customStart = startOfDay(new Date(r.targetStartDate));
          if (customStart > startDate) {
            startDate = customStart;
            activeNow = differenceInCalendarDays(startDate, today) <= 0;
            if (!activeNow && !r.dependsOnId) {
              waitingForName = `Data programada (${format(customStart, 'dd/MM/yyyy')})`;
            }
          }
        }

        // Caso 1: Material já 100% Concluído
        if (isCompleted && r.allocationMode !== 'fixed_time') {
          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: r.allocationMode,
            frequency: r.frequency,
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate: today,
            endDate: today,
            activeNow: false,
            isCompleted: true,
            waitingFor: waitingForName,
            remainingItems: 0,
            availableStudyDays: 0,
            dailyAmount: 0,
            unit: r.unit,
            dailyMinutes: 0,
            projectedDailyAmount: 0,
            projectedDailyMinutes: 0,
            scheduleNote: 'Material 100% concluído!',
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        // Caso 2: Periódico (Simulados NBME, UWSA, etc.)
        if (r.frequency !== 'daily') {
          const sessions = remainingItems > 0 ? remainingItems : 1;
          const isExclusive = r.exclusiveStudyDay ?? (r.type === 'nbme');
          const reviewDays = r.reviewDaysPerItem !== undefined ? r.reviewDaysPerItem : (r.type === 'nbme' ? 1 : 0);
          const totalDaysForThis = isExclusive ? sessions * (1 + reviewDays) : 0;
          const sessionDuration = (r.minutesPerItem || 300);

          const scheduledDates = generatePeriodicDates(startDate, r.frequency, sessions, r.preferredDayOfWeek);
          const finalEndDate = scheduledDates.length > 0 ? scheduledDates[scheduledDates.length - 1] : targetFinishDate;
          const effectiveEndDate = targetFinishDate > finalEndDate ? targetFinishDate : finalEndDate;

          const daysSpan = Math.max(1, differenceInCalendarDays(effectiveEndDate, startDate));
          const weeksAvailable = Math.max(1, Math.floor(daysSpan / 7));

          const freqLabel = r.frequency === 'weekly' 
            ? '1 sessão/semana' 
            : r.frequency === 'biweekly' 
              ? '1 sessão a cada 2 semanas' 
              : r.frequency === 'monthly'
                ? '1 sessão por mês'
                : 'Sessões esporádicas';

          const exclusiveDesc = isExclusive 
            ? ` (${1 + reviewDays}d dedicados por exame: 1d teste + ${reviewDays}d correção)`
            : '';

          let note = '';
          if (!activeNow) {
            note = `Aguardando ${waitingForName || 'fase anterior'}. Início previsto em ${format(startDate, 'dd/MM/yyyy')} • ${freqLabel}${exclusiveDesc}`;
          } else {
            note = `${freqLabel} (${weeksAvailable} semanas até a prova)${exclusiveDesc}`;
          }

          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: r.allocationMode,
            frequency: r.frequency,
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate,
            endDate: effectiveEndDate,
            scheduledDates,
            activeNow,
            isCompleted: false,
            waitingFor: waitingForName,
            remainingItems,
            availableStudyDays: totalStudyDays,
            dailyAmount: 0,
            unit: r.unit,
            dailyMinutes: 0,
            projectedDailyAmount: 1,
            projectedDailyMinutes: sessionDuration,
            totalSessions: sessions,
            sessionDurationMinutes: sessionDuration,
            exclusiveDaysReserved: totalDaysForThis,
            reviewDaysPerSession: reviewDays,
            scheduleNote: note,
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        const customDays = r.frequency === 'custom_days' ? (r.customDaysOfWeek || []) : undefined;

        // Caso 3: Tempo Fixo Reservado (Anki / Flashcards)
        if (r.allocationMode === 'fixed_time') {
          const dailyMinutes = Math.max(0, r.fixedDailyMinutes || 45);
          const daysFromStart = countStudyDays(startDate, targetFinishDate, customDays);
          
          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: 'fixed_time',
            frequency: r.frequency,
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate,
            endDate: targetFinishDate,
            activeNow,
            isCompleted: false,
            waitingFor: waitingForName,
            remainingItems,
            availableStudyDays: daysFromStart,
            dailyAmount: dailyMinutes,
            unit: 'min/dia',
            dailyMinutes,
            projectedDailyAmount: dailyMinutes,
            projectedDailyMinutes: dailyMinutes,
            scheduleNote: activeNow 
              ? `${dailyMinutes} min dedicados por dia de estudo`
              : `Inicia após ${waitingForName || 'fase anterior'} (${format(startDate, 'dd/MM/yyyy')}) - ${dailyMinutes} min/dia`,
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        // Caso 4: Material por Quantidade (QBanks, Livros, Vídeos)
        const totalStudyDaysFromStart = Math.max(1, countStudyDays(startDate, targetFinishDate, customDays));
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
          endDate = findDateAfterStudyDays(startDate, rawStudyDays, customDays);
        }

        if (r.targetEndDate) {
            const customEnd = startOfDay(new Date(r.targetEndDate));
            endDate = customEnd;
            allocatedEffectiveDays = Math.max(1, countStudyDays(startDate, endDate, customDays));
        }

        let amountPerDay = 0;
        let breakdown: string[] = [];
        let dailyAmountToday = 0;

        const hasFixedDays = r.fixedVolumeByDayOfWeek && Object.keys(r.fixedVolumeByDayOfWeek).length > 0;
        const hasGlobalFixed = r.fixedGlobalVolume !== undefined && r.fixedGlobalVolume !== null;

        let unfixedCount = 0;
        let totalFixed = 0;
        const projectedDowCounts = [0,0,0,0,0,0,0];

        // Pass 1: find amountPerDay for dynamic days
        if (hasFixedDays || hasGlobalFixed) {
            let cur = startOfDay(startDate);
            const end = startOfDay(endDate);
            while (cur <= end) {
              if (!isDayOff(cur)) {
                projectedDowCounts[cur.getDay()]++;
              }
              cur = addDays(cur, 1);
            }
            for (let d = 0; d < 7; d++) {
              const f = (r.fixedVolumeByDayOfWeek as any)?.[d];
              if (f !== undefined && f !== null) {
                totalFixed += f * projectedDowCounts[d];
              } else if (hasGlobalFixed) {
                totalFixed += r.fixedGlobalVolume! * projectedDowCounts[d];
              } else {
                unfixedCount += projectedDowCounts[d];
              }
            }
            const rem = Math.max(0, remainingItems - totalFixed);
            amountPerDay = unfixedCount > 0 ? Math.ceil((rem / unfixedCount) * 10) / 10 : 0;
        } else {
            amountPerDay = Math.ceil((remainingItems / Math.max(1, allocatedEffectiveDays)) * 10) / 10;
        }

        // Pass 2: Simulate day-by-day to find actual end date and avoid overflow
        let simulatedRemaining = remainingItems;
        let simCur = startOfDay(startDate);
        const originalEnd = startOfDay(endDate);
        let calculatedEndDate = originalEnd;
        let daysCount = 0;
        const actualDowCounts = [0,0,0,0,0,0,0];
        let actualTotal = 0;
        
        while (simulatedRemaining > 0) {
          if (!isDayOff(simCur)) {
              const dow = simCur.getDay();
              const f = (r.fixedVolumeByDayOfWeek as any)?.[dow];
              let planned = 0;
              if (f !== undefined && f !== null) {
                  planned = f;
              } else if (hasGlobalFixed) {
                  planned = r.fixedGlobalVolume!;
              } else {
                  planned = amountPerDay;
              }
              
              if (planned > 0) {
                  const actual = Math.min(simulatedRemaining, planned);
                  simulatedRemaining -= actual;
                  daysCount++;
                  actualDowCounts[dow]++;
                  actualTotal += actual;
                  if (simulatedRemaining <= 0) {
                      calculatedEndDate = simCur;
                      break;
                  }
              } else if (simCur > originalEnd) {
                  // Prevenir loop infinito se amountPerDay == 0 e não houver dias fixos cobrindo o restante
                  calculatedEndDate = simCur;
                  break;
              }
          }
          simCur = addDays(simCur, 1);
        }

        // Build Breakdown
        const daysOfWeekNames = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
        breakdown.push(`Volume pendente: ${remainingItems} ${r.unit}`);
        
        if (hasFixedDays || hasGlobalFixed) {
            for (let d = 0; d < 7; d++) {
                if (actualDowCounts[d] > 0) {
                    const f = (r.fixedVolumeByDayOfWeek as any)?.[d];
                    if (f !== undefined && f !== null) {
                        breakdown.push(`${daysOfWeekNames[d]}: ${f} ${r.unit}/dia (Fixo) x ${actualDowCounts[d]} dias`);
                    } else if (hasGlobalFixed) {
                        breakdown.push(`${daysOfWeekNames[d]}: ${r.fixedGlobalVolume} ${r.unit}/dia (Geral) x ${actualDowCounts[d]} dias`);
                    } else {
                        breakdown.push(`${daysOfWeekNames[d]}: ${amountPerDay} ${r.unit}/dia (Dinâmico) x ${actualDowCounts[d]} dias`);
                    }
                }
            }
            if (unfixedCount === 0 && actualTotal < remainingItems) {
                breakdown.push(`⚠️ Atenção: O volume total fixo projetado (${actualTotal}) não cobre o pendente (${remainingItems}) até a data alvo.`);
            }
        } else {
            breakdown.push(`Dias úteis até o final da fase: ${allocatedEffectiveDays}`);
            breakdown.push(`Cálculo: ${remainingItems} / ${allocatedEffectiveDays} = ${amountPerDay} ${r.unit}/dia`);
        }

        if (simulatedRemaining <= 0 && calculatedEndDate < originalEnd) {
            breakdown.push(`✅ Conclusão antecipada em ${format(calculatedEndDate, 'dd/MM/yyyy')} (atingiu ${remainingItems} ${r.unit}).`);
        } else if (simulatedRemaining > 0 || calculatedEndDate > originalEnd) {
            breakdown.push(`⚠️ Atenção: A data de término se estendeu até ${format(calculatedEndDate, 'dd/MM/yyyy')} para cobrir o volume pendente.`);
        }
        
        endDate = calculatedEndDate;
        allocatedEffectiveDays = daysCount > 0 ? daysCount : allocatedEffectiveDays;

        const todayDow = startOfDay(new Date()).getDay();
        const todayFixed = (r.fixedVolumeByDayOfWeek as any)?.[todayDow];
        if (todayFixed !== undefined && todayFixed !== null) {
          dailyAmountToday = todayFixed;
        } else if (hasGlobalFixed) {
          dailyAmountToday = r.fixedGlobalVolume!;
        } else {
          dailyAmountToday = amountPerDay;
        }

        const dailyMinutes = Math.round(dailyAmountToday * (r.minutesPerItem || 2));
        const calc: ResourceScheduleCalculation = {
          resourceId: r.id,
          resourceName: r.name || 'Sem nome',
          resourceType: r.type,
          allocationMode: 'item_target',
          frequency: 'daily',
          dependsOnId: r.dependsOnId,
          dependsOnName: waitingForName,
          startDate,
          endDate,
          activeNow,
          isCompleted: false,
          waitingFor: waitingForName,
          remainingItems,
          availableStudyDays: allocatedEffectiveDays,
          dailyAmount: dailyAmountToday,
          unit: r.unit,
          dailyMinutes,
          projectedDailyAmount: amountPerDay,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow 
            ? `${amountPerDay} ${r.unit}/dia (~${dailyMinutes} min/dia) até ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')} • ${amountPerDay} ${r.unit}/dia (${dailyMinutes} min/dia)`,
          calculationBreakdown: breakdown,
        };
        calculatedMap.set(r.id, calc);
        return calc;
      };

      resources.forEach(r => calculateResourceByDate(r));
      const resourcesSchedule = Array.from(calculatedMap.values());

      // Construir tarefas diárias
      let totalDailyMinutes = 0;
      let fixedTimeboxMinutes = 0;
      let variableContentMinutes = 0;
      const dailyTasks: DailySchedule[] = [];

      resourcesSchedule.forEach(item => {
        if (item.frequency === 'daily' || item.frequency === 'custom_days') {
          if (item.isCompleted) {
            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: 0,
              unit: item.unit,
              estimatedMinutes: 0,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'completed',
              isCompleted: true,
              startDate: item.startDate,
              endDate: item.endDate,
              availableStudyDays: 0,
              projectedDailyAmount: 0,
              projectedDailyMinutes: 0,
              note: 'Material 100% concluído! Próxima fase liberada.',
            });
          } else if (item.activeNow) {
            totalDailyMinutes += item.dailyMinutes;
            if (item.allocationMode === 'fixed_time') {
              fixedTimeboxMinutes += item.dailyMinutes;
            } else {
              variableContentMinutes += item.dailyMinutes;
            }

            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: item.dailyAmount,
              unit: item.unit,
              estimatedMinutes: item.dailyMinutes,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'active',
              isCompleted: false,
              startDate: item.startDate,
              endDate: item.endDate,
              availableStudyDays: item.availableStudyDays,
              projectedDailyAmount: item.dailyAmount,
              projectedDailyMinutes: item.dailyMinutes,
              note: item.scheduleNote || '',
              calculationBreakdown: item.calculationBreakdown,
            });
          } else {
            // Em espera (Queued)
            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: 0,
              unit: item.unit,
              estimatedMinutes: 0,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'queued',
              isCompleted: false,
              startDate: item.startDate,
              endDate: item.endDate,
              availableStudyDays: item.availableStudyDays,
              projectedDailyAmount: item.projectedDailyAmount || item.dailyAmount,
              projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,
              calculationBreakdown: item.calculationBreakdown,
              note: `Aguardando ${item.waitingFor || 'fase anterior'}. Início previsto em ${format(item.startDate, 'dd/MM/yyyy')} com meta de ${item.projectedDailyAmount || item.dailyAmount} ${item.unit}/dia (${item.projectedDailyMinutes || item.dailyMinutes} min/dia)`,
            });
          }
        } else {
          // Periódicos (ex: NBME)
          dailyTasks.push({
            resourceId: item.resourceId,
            resourceName: item.resourceName,
            resourceType: item.resourceType,
            amount: item.totalSessions || 1,
            unit: item.unit,
            estimatedMinutes: item.sessionDurationMinutes || 300,
            isTimebox: false,
            frequency: item.frequency,
            phaseStatus: item.isCompleted ? 'completed' : (item.activeNow ? 'active' : 'queued'),
            isCompleted: item.isCompleted,
            startDate: item.startDate,
            endDate: item.endDate,
            projectedDailyAmount: 1,
            projectedDailyMinutes: item.sessionDurationMinutes || 300,
            note: item.scheduleNote || 'Sessão periódica agendada',
            calculationBreakdown: item.calculationBreakdown,
            isExclusive: (item.exclusiveDaysReserved || 0) > 0,
            reviewDays: item.reviewDaysPerSession,
          });
        }
      });

      const daysToExamTotal = differenceInCalendarDays(examDate, today);
      const daysToExamStudy = countStudyDays(today, examDate);
      const daysToDeadlineTotal = differenceInCalendarDays(targetFinishDate, today);
      const daysToDeadlineStudy = countStudyDays(today, targetFinishDate);

      return {
        totalDays: totalDaysToFinish,
        studyDays: totalStudyDays,
        effectiveDailyStudyDays,
        totalExclusiveDays,
        estimatedEndDate: targetFinishDate,
        targetFinishDate,
        examDate,
        bufferDays: validBuffer,
        daysToExamTotal,
        daysToExamStudy,
        daysToDeadlineTotal,
        daysToDeadlineStudy,
        resourcesSchedule,
        dailyTasks,
        totalDailyMinutes,
        fixedTimeboxMinutes,
        variableContentMinutes,
        isValid: true,
      };
    }

    // ==========================================
    // MODO 2: POR RITMO DIÁRIO (BY_PACE)
    // ==========================================
    else {
      const calculatedMap = new Map<string, ResourceScheduleCalculation>();

      const calculateResourceByPace = (r: Resource): ResourceScheduleCalculation => {
        if (calculatedMap.has(r.id)) {
          return calculatedMap.get(r.id)!;
        }

        const isCompleted = (r.total > 0 && r.completed >= r.total);
        const remainingItems = Math.max(0, r.total - r.completed);

        let startDate = today;
        let waitingForName: string | undefined = undefined;
        let activeNow = true;

        if (r.dependsOnId && resourceMap.has(r.dependsOnId)) {
          const parentRes = resourceMap.get(r.dependsOnId)!;
          const parentCalc = calculateResourceByPace(parentRes);
          waitingForName = parentCalc.resourceName;

          if (parentCalc.isCompleted || parentRes.completed >= parentRes.total) {
            startDate = today;
            activeNow = true;
          } else {
            startDate = addDays(parentCalc.endDate, 1);
            activeNow = differenceInCalendarDays(startDate, today) <= 0;
          }
        }

        if (r.targetStartDate) {
          const customStart = startOfDay(new Date(r.targetStartDate));
          if (customStart > startDate) {
            startDate = customStart;
            activeNow = differenceInCalendarDays(startDate, today) <= 0;
            if (!activeNow && !r.dependsOnId) {
              waitingForName = `Data programada (${format(customStart, 'dd/MM/yyyy')})`;
            }
          }
        }

        if (isCompleted && r.allocationMode !== 'fixed_time') {
          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: r.allocationMode,
            frequency: r.frequency,
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate: today,
            endDate: today,
            activeNow: false,
            isCompleted: true,
            waitingFor: waitingForName,
            remainingItems: 0,
            availableStudyDays: 0,
            dailyAmount: 0,
            unit: r.unit,
            dailyMinutes: 0,
            projectedDailyAmount: 0,
            projectedDailyMinutes: 0,
            scheduleNote: 'Material 100% concluído!',
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        if (r.frequency !== 'daily') {
          const sessions = remainingItems > 0 ? remainingItems : 1;
          const sessionDuration = r.minutesPerItem || 300;
          const scheduledDates = generatePeriodicDates(startDate, r.frequency, sessions, r.preferredDayOfWeek);
          const endDate = scheduledDates.length > 0 ? scheduledDates[scheduledDates.length - 1] : startDate;

          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: r.allocationMode,
            frequency: r.frequency,
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate,
            endDate,
            scheduledDates,
            activeNow,
            isCompleted: false,
            waitingFor: waitingForName,
            remainingItems,
            availableStudyDays: countStudyDays(startDate, endDate),
            dailyAmount: 0,
            unit: r.unit,
            dailyMinutes: 0,
            projectedDailyAmount: 1,
            projectedDailyMinutes: sessionDuration,
            totalSessions: sessions,
            sessionDurationMinutes: sessionDuration,
            scheduleNote: `Periódico (${sessions} sessões previstas)`,
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        if (r.allocationMode === 'fixed_time') {
          const dailyMinutes = Math.max(0, r.fixedDailyMinutes || 45);
          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: 'fixed_time',
            frequency: 'daily',
            dependsOnId: r.dependsOnId,
            dependsOnName: waitingForName,
            startDate,
            endDate: addDays(startDate, 60),
            activeNow,
            isCompleted: false,
            waitingFor: waitingForName,
            remainingItems,
            availableStudyDays: 60,
            dailyAmount: dailyMinutes,
            unit: 'min/dia',
            dailyMinutes,
            projectedDailyAmount: dailyMinutes,
            projectedDailyMinutes: dailyMinutes,
            scheduleNote: `${dailyMinutes} min/dia contínuos`,
          };
          calculatedMap.set(r.id, calc);
          return calc;
        }

        // Modo Pace por Item Target
        const pace = Math.max(0.1, r.targetDailyPace || 1);
        let breakdown: string[] = [];
        let dailyAmountToday = 0;
        let calculatedEndDate = startDate;
        let daysCount = 0;

        const hasFixedDays = r.fixedVolumeByDayOfWeek && Object.keys(r.fixedVolumeByDayOfWeek).length > 0;
        const hasGlobalFixed = r.fixedGlobalVolume !== undefined && r.fixedGlobalVolume !== null;

        let simulatedRemaining = remainingItems;
        let simCur = startOfDay(startDate);
        
        while (simulatedRemaining > 0) {
          if (!isDayOff(simCur)) {
              const dow = simCur.getDay();
              const f = (r.fixedVolumeByDayOfWeek as any)?.[dow];
              let planned = 0;
              if (f !== undefined && f !== null) {
                  planned = f;
              } else if (hasGlobalFixed) {
                  planned = r.fixedGlobalVolume!;
              } else {
                  planned = pace;
              }
              
              if (planned > 0) {
                  const actual = Math.min(simulatedRemaining, planned);
                  simulatedRemaining -= actual;
                  daysCount++;
                  if (simulatedRemaining <= 0) {
                      calculatedEndDate = simCur;
                      break;
                  }
              }
          }
          simCur = addDays(simCur, 1);
        }

        const endDate = calculatedEndDate;

        if (r.targetEndDate) {
            const targetEnd = startOfDay(new Date(r.targetEndDate));
            if (endDate > targetEnd) {
                breakdown.push(`⚠️ Atenção: Ritmo insuficiente. A conclusão estimada (${format(endDate, 'dd/MM/yyyy')}) ultrapassa a data limite definida (${format(targetEnd, 'dd/MM/yyyy')}).`);
            }
        }

        const todayDow = startOfDay(new Date()).getDay();
        const todayFixed = (r.fixedVolumeByDayOfWeek as any)?.[todayDow];
        if (todayFixed !== undefined && todayFixed !== null) {
          dailyAmountToday = todayFixed;
        } else if (hasGlobalFixed) {
          dailyAmountToday = r.fixedGlobalVolume!;
        } else {
          dailyAmountToday = pace;
        }

        const dailyMinutes = Math.round(dailyAmountToday * (r.minutesPerItem || 2));

        breakdown.push(`Volume pendente: ${remainingItems} ${r.unit}`);
        if (hasFixedDays || hasGlobalFixed) {
            breakdown.push(`Ritmo padrão: ${pace} ${r.unit}/dia (aplicado aos dias não fixados)`);
            breakdown.push(`✅ Conclusão alcançada em ${format(endDate, 'dd/MM/yyyy')} após ${daysCount} dias úteis.`);
        } else {
            breakdown.push(`Ritmo (Pace) configurado: ${pace} ${r.unit}/dia`);
            breakdown.push(`Cálculo de dias: ${remainingItems} / ${pace} = ${daysCount} dias necessários`);
        }

        const calc: ResourceScheduleCalculation = {
          resourceId: r.id,
          resourceName: r.name || 'Sem nome',
          resourceType: r.type,
          allocationMode: 'item_target',
          frequency: 'daily',
          dependsOnId: r.dependsOnId,
          dependsOnName: waitingForName,
          startDate,
          endDate,
          activeNow,
          isCompleted: false,
          waitingFor: waitingForName,
          remainingItems,
          availableStudyDays: daysCount,
          dailyAmount: dailyAmountToday,
          unit: r.unit,
          dailyMinutes,
          projectedDailyAmount: pace,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow
            ? `${dailyAmountToday} ${r.unit}/dia (~${dailyMinutes} min/dia) • Término em ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto para iniciar em ${format(startDate, 'dd/MM/yyyy')} com ${dailyAmountToday} ${r.unit}/dia até ${format(endDate, 'dd/MM/yyyy')}`,
          calculationBreakdown: breakdown,
        };
        calculatedMap.set(r.id, calc);
        return calc;
      };

      resources.forEach(r => calculateResourceByPace(r));
      const resourcesSchedule = Array.from(calculatedMap.values());

      let maxEndDate = today;
      resourcesSchedule.forEach(item => {
        if (item.endDate > maxEndDate) {
          maxEndDate = item.endDate;
        }
      });

      const totalDays = Math.max(1, differenceInCalendarDays(maxEndDate, today));
      const totalStudyDays = countStudyDays(today, maxEndDate);

      let totalDailyMinutes = 0;
      let fixedTimeboxMinutes = 0;
      let variableContentMinutes = 0;
      const dailyTasks: DailySchedule[] = [];

      resourcesSchedule.forEach(item => {
        if (item.frequency === 'daily' || item.frequency === 'custom_days') {
          if (item.isCompleted) {
            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: 0,
              unit: item.unit,
              estimatedMinutes: 0,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'completed',
              isCompleted: true,
              startDate: item.startDate,
              endDate: item.endDate,
              note: 'Material 100% concluído!',
              calculationBreakdown: item.calculationBreakdown,
            });
          } else if (item.activeNow) {
            totalDailyMinutes += item.dailyMinutes;
            if (item.allocationMode === 'fixed_time') {
              fixedTimeboxMinutes += item.dailyMinutes;
            } else {
              variableContentMinutes += item.dailyMinutes;
            }

            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: item.dailyAmount,
              unit: item.unit,
              estimatedMinutes: item.dailyMinutes,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'active',
              isCompleted: false,
              startDate: item.startDate,
              endDate: item.endDate,
              availableStudyDays: item.availableStudyDays,
              projectedDailyAmount: item.dailyAmount,
              projectedDailyMinutes: item.dailyMinutes,
              note: item.scheduleNote || '',
              calculationBreakdown: item.calculationBreakdown,
            });
          } else {
            dailyTasks.push({
              resourceId: item.resourceId,
              resourceName: item.resourceName,
              resourceType: item.resourceType,
              amount: 0,
              unit: item.unit,
              estimatedMinutes: 0,
              isTimebox: item.allocationMode === 'fixed_time',
              frequency: item.frequency,
              phaseStatus: 'queued',
              isCompleted: false,
              startDate: item.startDate,
              endDate: item.endDate,
              availableStudyDays: item.availableStudyDays,
              projectedDailyAmount: item.projectedDailyAmount || item.dailyAmount,
              projectedDailyMinutes: item.projectedDailyMinutes || item.dailyMinutes,
              calculationBreakdown: item.calculationBreakdown,
              note: `Aguardando ${item.waitingFor || 'fase anterior'}. Início previsto em ${format(item.startDate, 'dd/MM/yyyy')} com meta de ${item.projectedDailyAmount || item.dailyAmount} ${item.unit}/dia (${item.projectedDailyMinutes || item.dailyMinutes} min/dia)`,
            });
          }
        } else {
          dailyTasks.push({
            resourceId: item.resourceId,
            resourceName: item.resourceName,
            resourceType: item.resourceType,
            amount: item.totalSessions || 1,
            unit: item.unit,
            estimatedMinutes: item.sessionDurationMinutes || 300,
            isTimebox: false,
            frequency: item.frequency,
            phaseStatus: item.isCompleted ? 'completed' : (item.activeNow ? 'active' : 'queued'),
            isCompleted: item.isCompleted,
            startDate: item.startDate,
            endDate: item.endDate,
            note: item.scheduleNote || 'Sessão periódica agendada',
            calculationBreakdown: item.calculationBreakdown,
          });
        }
      });

      let daysRemainingAfterFinish: number | undefined = undefined;
      let examDate: Date | null = null;
      let daysToExamTotal: number | undefined;
      let daysToExamStudy: number | undefined;
      
      if (examDateStr) {
        examDate = startOfDay(new Date(examDateStr));
        daysRemainingAfterFinish = differenceInCalendarDays(examDate, maxEndDate);
        daysToExamTotal = differenceInCalendarDays(examDate, today);
        daysToExamStudy = countStudyDays(today, examDate);
      }
      
      const daysToDeadlineTotal = differenceInCalendarDays(maxEndDate, today);
      const daysToDeadlineStudy = countStudyDays(today, maxEndDate);

      return {
        totalDays,
        studyDays: totalStudyDays,
        effectiveDailyStudyDays: totalStudyDays,
        totalExclusiveDays: 0,
        estimatedEndDate: maxEndDate,
        examDate,
        bufferDays: validBuffer,
        daysRemainingAfterFinish,
        daysToExamTotal,
        daysToExamStudy,
        daysToDeadlineTotal,
        daysToDeadlineStudy,
        resourcesSchedule,
        dailyTasks,
        totalDailyMinutes,
        fixedTimeboxMinutes,
        variableContentMinutes,
        isValid: true,
      };
    }
  }, [resources, examDateStr, daysOff, mode, bufferDays]);
}
