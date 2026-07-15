export const ANALYSIS_ERROR_TYPES = [
  'MISREAD_CONDITION',
  'KNOWLEDGE_GAP',
  'REASONING_ERROR',
  'CARELESSNESS',
  'OTHER',
] as const;

export const ANALYSIS_QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'true_false',
  'fill_blank',
  'short_answer',
  'material_analysis',
  'other',
] as const;
export type AnalysisQuestionType = (typeof ANALYSIS_QUESTION_TYPES)[number];

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
    type_code: AnalysisQuestionType;
    text: string;
    options: AnalysisOption[];
    user_answer: string;
    user_answer_evidence?: string;
    correct_answer: string;
  };
  knowledge_points: Array<{ code: string; name?: string; confidence: number }>;
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
