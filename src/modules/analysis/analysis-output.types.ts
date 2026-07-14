export const ANALYSIS_ERROR_TYPES = [
  'MISREAD_CONDITION',
  'KNOWLEDGE_GAP',
  'REASONING_ERROR',
  'CARELESSNESS',
  'OTHER',
] as const;

export interface AnalysisOption {
  label: string;
  text: string;
}

export interface AnalysisOutput {
  schema_version: '1.0';
  quality: {
    is_complete: boolean;
    needs_reupload: boolean;
    message: string;
  };
  question: {
    type_code: string;
    text: string;
    options: AnalysisOption[];
    user_answer: string;
    correct_answer: string;
  };
  knowledge_points: Array<{ code: string; confidence: number }>;
  diagnosis: {
    error_type: (typeof ANALYSIS_ERROR_TYPES)[number];
    reason: string;
    confidence: number;
    requires_user_confirmation: boolean;
  };
  solution: {
    summary: string;
    steps: string[];
    option_analysis: Array<{ label: string; analysis: string }>;
    memory_tip: string;
  };
  safety: {
    answer_confidence: number;
    needs_manual_review: boolean;
  };
}
