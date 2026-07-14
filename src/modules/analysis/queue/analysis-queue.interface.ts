export const ANALYSIS_QUEUE = Symbol('ANALYSIS_QUEUE');

export interface AnalysisQueue {
  enqueue(analysisJobId: string): Promise<void>;
}
