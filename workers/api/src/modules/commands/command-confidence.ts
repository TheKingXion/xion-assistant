export const HIGH_CONFIDENCE = 0.9;
export const MEDIUM_CONFIDENCE = 0.65;

export const calculateCommandConfidence = (input: {
  patternMatched: boolean;
  requiredParams: string[];
  params: Record<string, unknown>;
  shortcutConfidence?: number;
}) => {
  if (input.shortcutConfidence !== undefined) return Math.min(1, input.shortcutConfidence);
  if (!input.patternMatched) return 0;
  const complete = input.requiredParams.every((name) => input.params[name] !== undefined && input.params[name] !== "");
  return complete ? 0.95 : 0.86;
};
