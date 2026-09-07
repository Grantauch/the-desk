export type ClassroomCourse = 'US History' | 'Hidden History' | 'Beyond the Scoreboard';

export interface ClassroomCalendarHighlight {
  month: string;
  when: string;
  course: 'history' | 'hidden' | 'scoreboard';
  title: string;
  detail: string;
}

interface ClassroomCourseState {
  currentUnit: string;
  calendarHighlights: ClassroomCalendarHighlight[];
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
        title: 'the gilded age',
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
        title: 'the roswell headline reveal',
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
        title: 'inventing american sport',
        detail: 'Factories, leagues, the color line, and the system behind the score.',
      },
    ],
  },
};

export const currentUnitFor = (course: ClassroomCourse, availableUnits: string[]) => {
  const current = classroomState[course]?.currentUnit;
  if (!current) throw new Error(`Classroom state is missing a current unit for ${course}.`);
  if (!availableUnits.includes(current)) {
    throw new Error(
      `Classroom state says "${current}" is current for ${course}, but that unit does not exist on the course page.`,
    );
  }
  return current;
};

export const classroomCalendarHighlights = Object.values(classroomState)
  .flatMap((course) => course.calendarHighlights);
