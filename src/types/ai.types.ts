export interface AnalysisOptions {
  targetRole?: string;
  retryCount?: number;
  useCache?: boolean;
  industry?: string;
  experienceLevel?: "entry" | "mid" | "senior" | "lead" | "executive";
}

export interface CoverLetterOptions {
  tone?: "professional" | "enthusiastic" | "confident" | "creative";
  length?: "short" | "medium" | "long";
  includeContactInfo?: boolean;
  highlightSkills?: boolean;
}

export interface FeedbackOptions {
  focusAreas?: string[];
  includeActionItems?: boolean;
  includeStrengths?: boolean;
  includeWeaknesses?: boolean;
  includeRecommendations?: boolean;
}

export interface JobMatchOptions {
  minMatchScore?: number;
  limit?: number;
  includeExpired?: boolean;
  includeAllMatches?: boolean;
}

export interface ImprovementOptions {
  includeContentSuggestions?: boolean;
  includeFormattingSuggestions?: boolean;
  includeKeywordSuggestions?: boolean;
  includeActionVerbs?: boolean;
}

export interface ResumeAnalysis {
  matchScore: number;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  skillsMatch: {
    matching: string[];
    missing: string[];
    additional: string[];
  };
  keywordMatch: {
    found: string[];
    missing: string[];
  };
  summary: string;
  detailedFeedback: {
    content: string[];
    structure: string[];
    formatting: string[];
  };
  suggestedImprovements: {
    priority: "high" | "medium" | "low";
    suggestion: string;
    reason: string;
  }[];
}
