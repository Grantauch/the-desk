export type ClassroomCourse = 'US History' | 'Hidden History' | 'Beyond the Scoreboard';

export interface ClassroomCalendarHighlight {
  month: string;
  when: string;
  course: 'history' | 'hidden' | 'scoreboard';
  title: string;
  detail: string;
}

export interface ClassroomCourseState {
  currentUnit: string;
  calendarHighlights: Omit<ClassroomCalendarHighlight, 'title'>[];
}

/**
 * The one small, explicit record of where each class actually is.
 *
 * Publishing a resource never advances a class automatically. Change this file only
 * when the class itself moves. Course pages and the calendar read the same record so
 * students cannot get two different answers about what is current.
 */
export const classroomState: Record<ClassroomCourse, ClassroomCourseState> = {
  'US History': {
    currentUnit: 'The Gilded Age',
    calendarHighlights: [
      {
        month: 'september',
        when: 'right now',
        course: 'history',
        detail: 'Railroads, robber barons, unions, and the price of progress.',
      },
    ],
  },
  'Hidden History': {
    currentUnit: 'The Official Story vs. The Rumor',
    calendarHighlights: [
      {
        month: 'september',
        when: 'first week',
        course: 'hidden',
        detail: 'Your first verdict of the year—and an exit ticket worth hanging onto until June.',
      },
    ],
  },
  'Beyond the Scoreboard': {
    currentUnit: 'Inventing American Sport, 1860s–1900',
    calendarHighlights: [
      {
        month: 'september',
        when: 'first week',
        course: 'scoreboard',
        detail: 'Factories, leagues, the color line, and the system behind the score.',
      },
    ],
  },
};

export const currentUnitFor = (course: ClassroomCourse, availableUnits: string[], state = classroomState) => {
  const current = state[course]?.currentUnit;
  if (!current) throw new Error(`Classroom state is missing a current unit for ${course}.`);
  if (availableUnits.filter(unit => unit === current).length !== 1) {
    throw new Error(
      `Classroom state says "${current}" is current for ${course}, but that unit must exist exactly once on the course page.`,
    );
  }
  return current;
};

export const academicMonths = ['august', 'september', 'october', 'november', 'december', 'january', 'february', 'march', 'april', 'may', 'june', 'july'];

export const calendarHighlightsFor = (state = classroomState): ClassroomCalendarHighlight[] =>
  Object.values(state).flatMap(({ currentUnit, calendarHighlights }) => {
    if (!currentUnit?.trim()) throw new Error('Classroom state is missing a current unit.');
    return calendarHighlights.map(highlight => {
      if (!academicMonths.includes(highlight.month) || !highlight.when.trim() || !highlight.detail.trim()) {
        throw new Error('Classroom state has an invalid calendar highlight.');
      }
      // A current-unit calendar title is derived, never a second editable copy.
      return { ...highlight, title: currentUnit };
    });
  });

export const classroomCalendarHighlights = calendarHighlightsFor();
