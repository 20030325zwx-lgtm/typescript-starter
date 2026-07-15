import { Injectable } from '@nestjs/common';
import { ReviewSelfRating } from '@prisma/client';

export interface ReviewSchedule {
  effectiveRating: ReviewSelfRating;
  intervalDays: number;
  masteryDelta: number;
}

@Injectable()
export class ReviewSchedulerService {
  calculate(
    currentIntervalDays: number,
    rating: ReviewSelfRating,
    isCorrect: boolean | null,
  ): ReviewSchedule {
    const effectiveRating =
      isCorrect === false &&
      (rating === ReviewSelfRating.GOOD || rating === ReviewSelfRating.EASY)
        ? ReviewSelfRating.AGAIN
        : rating;
    const current = Math.max(1, currentIntervalDays);

    switch (effectiveRating) {
      case ReviewSelfRating.AGAIN:
        return { effectiveRating, intervalDays: 1, masteryDelta: -12 };
      case ReviewSelfRating.HARD:
        return {
          effectiveRating,
          intervalDays: this.cap(Math.max(2, Math.round(current * 1.5))),
          masteryDelta: 2,
        };
      case ReviewSelfRating.GOOD:
        return {
          effectiveRating,
          intervalDays: this.cap(Math.max(4, Math.round(current * 2.2))),
          masteryDelta: 8,
        };
      case ReviewSelfRating.EASY:
        return {
          effectiveRating,
          intervalDays: this.cap(Math.max(7, Math.round(current * 3.2))),
          masteryDelta: 12,
        };
    }
  }

  private cap(days: number): number {
    return Math.min(90, days);
  }
}
