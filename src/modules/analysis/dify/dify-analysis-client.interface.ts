import type { AnalysisOutput } from '../analysis-output.types';

export const DIFY_ANALYSIS_CLIENT = Symbol('DIFY_ANALYSIS_CLIENT');

export interface DifyAnalysisInput {
  userId: string;
  imageUrl: string;
  userAnswer: string | null;
  correctAnswer: string | null;
  source: string | null;
  note: string | null;
  knowledgePointCandidates: Array<{
    code: string;
    name: string;
    parentCode: string | null;
  }>;
  schemaVersion: string;
}

export interface DifyAnalysisResult {
  runId: string | null;
  rawOutputs: Record<string, unknown>;
  output: unknown;
}

export interface DifyAnalysisClient {
  run(input: DifyAnalysisInput): Promise<DifyAnalysisResult>;
}

export type { AnalysisOutput };
