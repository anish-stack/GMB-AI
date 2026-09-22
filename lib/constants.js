export const TASK_STATUS = {
  PENDING: "PENDING",
  RESEARCHING: "RESEARCHING",
  KEYWORD_RESEARCH: "KEYWORD_RESEARCH",
  GENERATING: "GENERATING",
  IMAGE_GENERATING: "IMAGE_GENERATING",
  QA_RUNNING: "QA_RUNNING",
  READY_FOR_REVIEW: "READY_FOR_REVIEW",
  NEEDS_REVIEW: "NEEDS_REVIEW",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  PUBLISHED: "PUBLISHED",
  POST_DELETED: "POST_DELETED",
  FAILED: "FAILED",
};

export const STATUS_TONE = {
  PENDING: "slate",
  RESEARCHING: "blue",
  KEYWORD_RESEARCH: "blue",
  GENERATING: "blue",
  IMAGE_GENERATING: "blue",
  QA_RUNNING: "blue",
  READY_FOR_REVIEW: "green",
  NEEDS_REVIEW: "amber",
  APPROVED: "indigo",
  REJECTED: "red",
  PUBLISHED: "emerald",
  POST_DELETED: "red",
  FAILED: "red",
};

export const POST_TYPES = [
  "Offer",
  "Service",
  "Educational",
  "Local",
  "Seasonal",
  "Promotional",
  "FAQ",
  "Awareness",
  "Product/Service Highlight",
];

export const TONES = ["Professional", "Friendly", "Premium", "Casual", "Informative"];
export const FREQUENCIES = ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"];
export const KW_TYPES = ["PRIMARY", "SECONDARY", "LONG_TAIL", "LOCATION"];
export const QA_PASS_SCORE = 80;
export const DUPLICATE_THRESHOLD = 0.86;
/** Max number of times a single GMB post's image can be re-generated (upload is unlimited). */
export const IMAGE_REGEN_LIMIT = Number(process.env.IMAGE_REGEN_LIMIT || 2);
