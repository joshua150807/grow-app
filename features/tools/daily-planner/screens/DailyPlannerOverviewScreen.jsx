import { useCallback, useRef, useState } from 'react';
import { Stack, router, useFocusEffect } from 'expo-router';

import { toDateStr } from '../utils/plannerUtils';
import { useDailyPlannerEvents } from '../hooks/useDailyPlannerEvents';
import { PlannerCalendar } from '../components/PlannerCalendar';

export default function DailyPlannerOverviewScreen() {
  const today = useRef(new Date()).current;
  const todayStr = toDateStr(today);

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());

  const {
    monthEventDates,
    loadMonthEvents,
  } = useDailyPlannerEvents(currentYear, currentMonth, null);

  useFocusEffect(
    useCallback(() => {
      loadMonthEvents?.();
    }, [loadMonthEvents])
  );

  const openDay = useCallback((dateStr) => {
    if (!dateStr) return;

    router.push({
      pathname: '/tools/daily-planner/[dateStr]',
      params: { dateStr },
    });
  }, []);

  const prevMonth = useCallback(() => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(year => year - 1);
      return;
    }

    setCurrentMonth(month => month - 1);
  }, [currentMonth]);

  const nextMonth = useCallback(() => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(year => year + 1);
      return;
    }

    setCurrentMonth(month => month + 1);
  }, [currentMonth]);

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: true,
          fullScreenGestureEnabled: false,
        }}
      />
      <PlannerCalendar
        currentYear={currentYear}
        currentMonth={currentMonth}
        todayStr={todayStr}
        monthEventDates={monthEventDates}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        onOpenDay={openDay}
      />
    </>
  );
}
