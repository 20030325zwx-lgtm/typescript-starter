import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Ajv, { type ValidateFunction } from 'ajv';
import { AnalysisExecutionError } from './analysis-execution.error';
import {
  ANALYSIS_ERROR_TYPES,
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
        type_code: { type: 'string', minLength: 1, maxLength: 64 },
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
        correct_answer: { type: 'string', maxLength: 20 },
      },
    },
    knowledge_points: {
      type: 'array',
      minItems: 1,
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['code', 'confidence'],
        properties: {
          code: { type: 'string', minLength: 1, maxLength: 64 },
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
    if (value.quality.needs_reupload || !value.quality.is_complete) {
      throw new AnalysisExecutionError(
        'IMAGE_REUPLOAD_REQUIRED',
        '图片内容不完整或不清晰，请重新上传',
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
}
