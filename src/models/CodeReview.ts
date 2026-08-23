import mongoose, { Document, Schema } from 'mongoose';
import { ReviewResult, ReviewMetadata, Suggestion, Issue, ReviewComment } from '@/types';

// Define the base interface without id to avoid conflicts
export interface CodeReviewData {
  pullRequestId: number;
  pullRequestNumber?: number;
  repositoryId: number;
  repositoryName: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  review?: ReviewResult;
  metadata?: ReviewMetadata;
  reviewedHeadSha?: string;
  githubReviewId?: number;
  findingCommentIds?: number[];
  findingTrackingComplete?: boolean;
  approvalHeadSha?: string;
  approvalReviewId?: number;
  approvedAt?: Date;
}

export interface CodeReviewDocument extends CodeReviewData, Document {}

const SuggestionSchema = new Schema<Suggestion>({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['improvement', 'bug_fix', 'security', 'performance', 'style'],
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    required: true 
  },
  file: { type: String },
  line: { type: Number },
  code: { type: String },
  suggestedFix: { type: String },
});

const IssueSchema = new Schema<Issue>({
  id: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['bug', 'security', 'performance', 'style', 'maintainability'],
    required: true 
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  severity: { 
    type: String, 
    enum: ['low', 'medium', 'high', 'critical'],
    required: true 
  },
  file: { type: String },
  line: { type: Number },
  code: { type: String },
  suggestedFix: { type: String },
});

const ReviewCommentSchema = new Schema<ReviewComment>({
  file: { type: String, required: true },
  line: { type: Number, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    required: true,
  },
  category: {
    type: String,
    enum: ['bug', 'security', 'performance', 'style', 'maintainability'],
    required: true,
  },
  body: { type: String, required: true },
  suggestion: { type: String },
});

const ReviewResultSchema = new Schema<ReviewResult>({
  summary: { type: String, required: true },
  score: { type: Number, required: true, min: 0, max: 100 },
  suggestions: [SuggestionSchema],
  issues: [IssueSchema],
  positiveAspects: [{ type: String }],
  comments: [ReviewCommentSchema],
});

const ReviewMetadataSchema = new Schema<ReviewMetadata>({
  totalFiles: { type: Number, required: true },
  totalLines: { type: Number, required: true },
  languages: [{ type: String }],
  aiModel: { type: String, required: true },
  processingTime: { type: Number, required: true },
  tokensUsed: { type: Number, required: true },
  tokensEstimated: { type: Boolean },
  aiProvider: { type: String },
  promptCharacters: { type: Number },
  responseCharacters: { type: Number },
  contextDepth: { type: String },
  resolvedFindingCount: { type: Number },
  unresolvedFindingCount: { type: Number },
  contextFileCount: { type: Number },
  contextCharacters: { type: Number },
  contextTruncatedFileCount: { type: Number },
  contextFiles: [{
    filename: { type: String, required: true },
    characters: { type: Number, required: true },
    truncated: { type: Boolean, required: true },
    reason: { type: String },
    _id: false,
  }],
});

const CodeReviewSchema = new Schema<CodeReviewDocument>({
  pullRequestId: { type: Number, required: true },
  pullRequestNumber: { type: Number },
  repositoryId: { type: Number, required: true },
  repositoryName: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  review: { type: ReviewResultSchema },
  metadata: { type: ReviewMetadataSchema },
  reviewedHeadSha: { type: String },
  githubReviewId: { type: Number },
  findingCommentIds: [{ type: Number }],
  findingTrackingComplete: { type: Boolean, default: false },
  approvalHeadSha: { type: String },
  approvalReviewId: { type: Number },
  approvedAt: { type: Date },
}, {
  timestamps: true,
});

// Indexes for better query performance
CodeReviewSchema.index({ pullRequestId: 1, repositoryId: 1 }, { unique: true });
CodeReviewSchema.index({ repositoryId: 1 });
CodeReviewSchema.index({ status: 1 });
CodeReviewSchema.index({ createdAt: -1 });

export const CodeReviewModel = mongoose.models.CodeReview || mongoose.model<CodeReviewDocument>('CodeReview', CodeReviewSchema);
