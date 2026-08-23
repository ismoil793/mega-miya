// GitHub related types
export interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
  name?: string;
  email?: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description?: string;
  language?: string;
  stargazers_count: number;
  forks_count: number;
}

export interface GitHubPullRequest {
  id: number;
  number: number;
  title: string;
  body?: string;
  state: 'open' | 'closed' | 'merged';
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  head: {
    ref: string;
    sha: string;
  };
  base: {
    ref: string;
    sha: string;
  };
  repository: GitHubRepository;
}

export interface GitHubCommit {
  sha: string;
  message: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  committer: {
    name: string;
    email: string;
    date: string;
  };
}

export interface GitHubFile {
  sha: string;
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  content?: string;
}

// AI Review types
export interface CodeReview {
  id: string;
  pullRequestId: number;
  pullRequestNumber?: number;
  repositoryId: number;
  repositoryName: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
  review: ReviewResult;
  metadata: ReviewMetadata;
}

export interface ReviewResult {
  summary: string;
  score: number; // 0-100
  suggestions: Suggestion[];
  issues: Issue[];
  positiveAspects: string[];
  /** Line-anchored inline findings, posted as PR review comments. */
  comments?: ReviewComment[];
}

export type ReviewSeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReviewCategory = 'bug' | 'security' | 'performance' | 'style' | 'maintainability';

export interface ReviewComment {
  file: string;
  line: number;
  severity: ReviewSeverity;
  category: ReviewCategory;
  /** The reviewer's message for this line. */
  body: string;
  /** Optional replacement code rendered as a GitHub ```suggestion``` block. */
  suggestion?: string;
}

export interface Suggestion {
  id: string;
  type: 'improvement' | 'bug_fix' | 'security' | 'performance' | 'style';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  line?: number;
  code?: string;
  suggestedFix?: string;
}

export interface Issue {
  id: string;
  type: 'bug' | 'security' | 'performance' | 'style' | 'maintainability';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file?: string;
  line?: number;
  code?: string;
  suggestedFix?: string;
}

export interface ReviewMetadata {
  totalFiles: number;
  totalLines: number;
  languages: string[];
  aiModel: string;
  processingTime: number;
  tokensUsed: number;
  tokensEstimated?: boolean;
  aiProvider?: string;
  promptCharacters?: number;
  responseCharacters?: number;
  contextDepth?: string;
  resolvedFindingCount?: number;
  unresolvedFindingCount?: number;
  contextFileCount?: number;
  contextCharacters?: number;
  contextTruncatedFileCount?: number;
  contextFiles?: Array<{ filename: string; characters: number; truncated: boolean; reason?: string }>;
}

// User and Authentication types
export interface User {
  id: string;
  githubId: number;
  githubUsername: string;
  email?: string;
  name?: string;
  avatarUrl: string;
  repositories: string[]; // repository full names
  settings: UserSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSettings {
  autoReview: boolean;
  reviewLanguages: string[];
  excludedPatterns: string[];
  notificationPreferences: {
    email: boolean;
    slack?: string;
  };
}

// Webhook types
export interface GitHubWebhookPayload {
  action: string;
  pull_request?: GitHubPullRequest;
  repository?: GitHubRepository;
  sender?: GitHubUser;
  installation?: {
    id: number;
  };
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
