export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface CardState {
  repetition: number;
  interval: number;
  easeFactor: number;
}

export function calculateNextState(currentState: CardState, rating: Rating): CardState {
  let { repetition, interval, easeFactor } = currentState;

  if (rating === 'again') {
    repetition = 0;
    interval = 1; // 1 day
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else if (rating === 'hard') {
    easeFactor = Math.max(1.3, easeFactor - 0.15);
    interval = repetition === 0 ? 1 : interval * 1.2;
  } else if (rating === 'good') {
    interval = repetition === 0 ? 1 : (repetition === 1 ? 6 : interval * easeFactor);
    repetition += 1;
  } else if (rating === 'easy') {
    easeFactor += 0.15;
    interval = repetition === 0 ? 4 : (repetition === 1 ? 6 : interval * easeFactor * 1.3);
    repetition += 1;
  }

  // Round interval to whole days
  interval = Math.round(interval);

  return { repetition, interval, easeFactor };
}
