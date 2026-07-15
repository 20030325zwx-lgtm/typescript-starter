import { ReviewSelfRating } from '@prisma/client';
import { ReviewSchedulerService } from './review-scheduler.service';

describe('ReviewSchedulerService', () => {
  const service = new ReviewSchedulerService();

  it.each([
    [ReviewSelfRating.AGAIN, 1, -12],
    [ReviewSelfRating.HARD, 3, 2],
    [ReviewSelfRating.GOOD, 4, 8],
    [ReviewSelfRating.EASY, 7, 12],
  ])('calculates %s review scheduling', (rating, days, delta) => {
    expect(service.calculate(2, rating, true)).toMatchObject({
      effectiveRating: rating,
      intervalDays: days,
      masteryDelta: delta,
    });
  });

  it('downgrades a wrong GOOD answer to AGAIN', () => {
    expect(service.calculate(14, ReviewSelfRating.GOOD, false)).toMatchObject({
      effectiveRating: ReviewSelfRating.AGAIN,
      intervalDays: 1,
      masteryDelta: -12,
    });
  });

  it('caps long intervals at 90 days', () => {
    expect(
      service.calculate(60, ReviewSelfRating.EASY, true).intervalDays,
    ).toBe(90);
  });
});
