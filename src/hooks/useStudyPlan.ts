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
} from '../types';

export function useStudyPlan(
  resources: Resource[],
  examDateStr: string,
  daysOff: number[], // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
  mode: StudyMode = 'by_date',
  bufferDays: number = 14
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

    const isDayOff = (date: Date) => daysOff.includes(date.getDay());

    // Conta quantos dias de estudo (não-folga) existem no intervalo [startDate, endDate]
    const countStudyDays = (startDate: Date, endDate: Date): number => {
      if (isBefore(endDate, startDate)) return 0;
      let count = 0;
      let cur = startOfDay(startDate);
      const end = startOfDay(endDate);

      while (cur <= end) {
        if (!isDayOff(cur)) {
          count++;
        }
        cur = addDays(cur, 1);
      }
      return count;
    };

    // Encontra a data após N dias de estudo a partir de startDate
    const findDateAfterStudyDays = (startDate: Date, neededStudyDays: number): Date => {
      if (neededStudyDays <= 0) return startDate;
      let cur = startOfDay(startDate);
      let foundDays = 0;

      while (foundDays < neededStudyDays) {
        if (!isDayOff(cur)) {
          foundDays++;
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

          const daysSpan = Math.max(1, differenceInCalendarDays(targetFinishDate, startDate));
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
            endDate: targetFinishDate,
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

        // Caso 3: Tempo Fixo Reservado (Anki / Flashcards)
        if (r.allocationMode === 'fixed_time') {
          const dailyMinutes = Math.max(0, r.fixedDailyMinutes || 45);
          const daysFromStart = countStudyDays(startDate, targetFinishDate);
          
          const calc: ResourceScheduleCalculation = {
            resourceId: r.id,
            resourceName: r.name || 'Sem nome',
            resourceType: r.type,
            allocationMode: 'fixed_time',
            frequency: 'daily',
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
          dailyAmount: amountPerDay,
          unit: r.unit,
          dailyMinutes,
          projectedDailyAmount: amountPerDay,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow 
            ? `${amountPerDay} ${r.unit}/dia (~${dailyMinutes} min/dia) até ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto: ${format(startDate, 'dd/MM/yyyy')} a ${format(endDate, 'dd/MM/yyyy')} • ${amountPerDay} ${r.unit}/dia (${dailyMinutes} min/dia)`,
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
        if (item.frequency === 'daily') {
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
            isExclusive: (item.exclusiveDaysReserved || 0) > 0,
            reviewDays: item.reviewDaysPerSession,
          });
        }
      });

      return {
        totalDays: totalDaysToFinish,
        studyDays: totalStudyDays,
        effectiveDailyStudyDays,
        totalExclusiveDays,
        estimatedEndDate: targetFinishDate,
        targetFinishDate,
        examDate,
        bufferDays: validBuffer,
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
          const weeksNeeded = r.frequency === 'weekly' ? sessions : r.frequency === 'biweekly' ? sessions * 2 : sessions * 4;
          const endDate = addDays(startDate, weeksNeeded * 7);

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
        const daysNeeded = Math.ceil(remainingItems / pace);
        const endDate = findDateAfterStudyDays(startDate, daysNeeded);
        const dailyMinutes = Math.round(pace * (r.minutesPerItem || 2));

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
          availableStudyDays: daysNeeded,
          dailyAmount: pace,
          unit: r.unit,
          dailyMinutes,
          projectedDailyAmount: pace,
          projectedDailyMinutes: dailyMinutes,
          scheduleNote: activeNow
            ? `${pace} ${r.unit}/dia (~${dailyMinutes} min/dia) • Término em ${format(endDate, 'dd/MM/yyyy')}`
            : `Previsto para iniciar em ${format(startDate, 'dd/MM/yyyy')} com ${pace} ${r.unit}/dia até ${format(endDate, 'dd/MM/yyyy')}`,
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
        if (item.frequency === 'daily') {
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
          });
        }
      });

      let daysRemainingAfterFinish: number | undefined = undefined;
      let examDate: Date | null = null;
      if (examDateStr) {
        examDate = startOfDay(new Date(examDateStr));
        daysRemainingAfterFinish = differenceInCalendarDays(examDate, maxEndDate);
      }

      return {
        totalDays,
        studyDays: totalStudyDays,
        effectiveDailyStudyDays: totalStudyDays,
        totalExclusiveDays: 0,
        estimatedEndDate: maxEndDate,
        examDate,
        bufferDays: validBuffer,
        daysRemainingAfterFinish,
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
