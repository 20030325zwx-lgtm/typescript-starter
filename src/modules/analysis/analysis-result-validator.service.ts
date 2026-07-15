import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ajv, { type ValidateFunction } from 'ajv';
import { AnalysisExecutionError } from './analysis-execution.error';
import {
  ANALYSIS_ERROR_TYPES,
  ANALYSIS_QUESTION_TYPES,
  type AnalysisOutput,
} from './analysis-output.types';

const schema: object = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schema_version',
    'quality',
    'question',
    'knowledge_points',
    'diagnosis',
    'solution',
    'safety',
  ],
  properties: {
    schema_version: { type: 'string', const: '1.0' },
    quality: {
      type: 'object',
      additionalProperties: false,
      required: ['is_complete', 'needs_reupload', 'message'],
      properties: {
        is_complete: { type: 'boolean' },
        needs_reupload: { type: 'boolean' },
        message: { type: 'string', maxLength: 500 },
      },
    },
    question: {
      type: 'object',
      additionalProperties: false,
      required: [
        'type_code',
        'text',
        'options',
        'user_answer',
        'correct_answer',
      ],
      properties: {
        type_code: { type: 'string', enum: [...ANALYSIS_QUESTION_TYPES] },
        text: { type: 'string', minLength: 1, maxLength: 20000 },
        options: {
          type: 'array',
          minItems: 0,
          maxItems: 20,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'text'],
            properties: {
              label: { type: 'string', minLength: 1, maxLength: 20 },
              text: { type: 'string', minLength: 1, maxLength: 2000 },
            },
          },
        },
        user_answer: { type: 'string', maxLength: 20 },
        user_answer_evidence: { type: 'string', maxLength: 500 },
        correct_answer: { type: 'string', maxLength: 20 },
      },
    },
    knowledge_points: {
      type: 'array',
      minItems: 0,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'confidence'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 64 },
          name: { type: 'string', maxLength: 100 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    },
    diagnosis: {
      type: 'object',
      additionalProperties: false,
      required: [
        'error_type',
        'reason',
        'confidence',
        'requires_user_confirmation',
      ],
      properties: {
        error_type: { type: 'string', enum: [...ANALYSIS_ERROR_TYPES] },
        reason: { type: 'string', minLength: 1, maxLength: 10000 },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        requires_user_confirmation: { type: 'boolean' },
      },
    },
    solution: {
      type: 'object',
      additionalProperties: false,
      required: ['summary', 'steps', 'option_analysis', 'memory_tip'],
      properties: {
        summary: { type: 'string', minLength: 1, maxLength: 20000 },
        steps: {
          type: 'array',
          minItems: 1,
          maxItems: 30,
          items: { type: 'string', minLength: 1, maxLength: 5000 },
        },
        option_analysis: {
          type: 'array',
          minItems: 0,
          maxItems: 20,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['label', 'analysis'],
            properties: {
              label: { type: 'string', minLength: 1, maxLength: 20 },
              analysis: { type: 'string', minLength: 1, maxLength: 5000 },
            },
          },
        },
        memory_tip: { type: 'string', maxLength: 5000 },
      },
    },
    safety: {
      type: 'object',
      additionalProperties: false,
      required: ['answer_confidence', 'needs_manual_review'],
      properties: {
        answer_confidence: { type: 'number', minimum: 0, maximum: 1 },
        needs_manual_review: { type: 'boolean' },
      },
    },
  },
};

@Injectable()
export class AnalysisResultValidatorService {
  private readonly validateSchema: ValidateFunction<AnalysisOutput>;
  private readonly answerConfidenceThreshold: number;

  constructor(config: ConfigService) {
    this.validateSchema = new Ajv({ allErrors: true }).compile<AnalysisOutput>(
      schema,
    );
    this.answerConfidenceThreshold = config.get<number>(
      'DIFY_ANSWER_CONFIDENCE_THRESHOLD',
      0.8,
    );
  }

  validate(
    value: unknown,
    context: {
      schemaVersion: string;
      userAnswer: string | null;
      candidateCodes: Set<string>;
    },
  ): AnalysisOutput {
    this.normalizeQuestionType(value);
    if (!this.validateSchema(value)) {
      throw this.invalid();
    }
    if (value.schema_version !== context.schemaVersion) {
      throw this.invalid();
    }
    if (
      context.userAnswer &&
      value.question.user_answer.trim() !== context.userAnswer.trim()
    ) {
      throw this.invalid();
    }
    if (!context.userAnswer) {
      value.question.user_answer = '';
      value.question.user_answer_evidence = '';
      value.diagnosis.error_type = 'OTHER';
      value.diagnosis.reason =
        '未提供可验证的用户作答，请确认答案后再进行错因诊断。';
      value.diagnosis.requires_user_confirmation = true;
    }
    if (value.quality.needs_reupload || !value.quality.is_complete) {
      throw new AnalysisExecutionError(
        'IMAGE_REUPLOAD_REQUIRED',
        value.quality.message || '未识别到完整有效的题目，请重新上传',
        false,
      );
    }
    if (value.knowledge_points.length === 0) {
      throw new AnalysisExecutionError(
        'DIFY_KNOWLEDGE_POINT_INVALID',
        '未能识别题目对应的知识点，请重新分析',
        false,
      );
    }
    if (
      value.knowledge_points.some(
        ({ code }) => !context.candidateCodes.has(code),
      )
    ) {
      throw new AnalysisExecutionError(
        'DIFY_KNOWLEDGE_POINT_INVALID',
        'AI 返回了未知知识点，请重新分析',
        false,
      );
    }

    value.safety.needs_manual_review =
      value.safety.needs_manual_review ||
      value.diagnosis.requires_user_confirmation ||
      value.safety.answer_confidence < this.answerConfidenceThreshold;
    return value;
  }

  private invalid(): AnalysisExecutionError {
    return new AnalysisExecutionError(
      'DIFY_OUTPUT_INVALID',
      'AI 返回结果格式异常，请重新分析',
      false,
    );
  }

  private normalizeQuestionType(value: unknown): void {
    if (!this.isRecord(value) || !this.isRecord(value.question)) return;
    const question = value.question;
    if (
      typeof question.type_code === 'string' &&
      !ANALYSIS_QUESTION_TYPES.includes(
        question.type_code as (typeof ANALYSIS_QUESTION_TYPES)[number],
      )
    ) {
      question.type_code =
        Array.isArray(question.options) && question.options.length > 0
          ? 'single_choice'
          : 'other';
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
