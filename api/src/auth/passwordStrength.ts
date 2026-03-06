import zxcvbn from 'zxcvbn';

// Minimum required score (0-4)
// 0: too guessable
// 1: very guessable
// 2: somewhat guessable
// 3: safely unguessable (our minimum)
// 4: very unguessable
const MINIMUM_PASSWORD_SCORE = 3;
const MINIMUM_PASSWORD_LENGTH = 10;

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number;
  feedback: {
    warning?: string;
    suggestions: string[];
  };
  crackTime?: string;
}

/**
 * Validates password strength using zxcvbn
 *
 * @param password - The password to validate
 * @param userInputs - Optional array of user-specific strings (email, name) to penalize
 * @returns PasswordStrengthResult indicating if password meets requirements
 */
export function validatePasswordStrength(
  password: string,
  userInputs: string[] = []
): PasswordStrengthResult {
  // Check minimum length first
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return {
      isValid: false,
      score: 0,
      feedback: {
        warning: `Password must be at least ${MINIMUM_PASSWORD_LENGTH} characters long.`,
        suggestions: ['Use a longer password with at least 10 characters.'],
      },
    };
  }

  // Run zxcvbn analysis
  const result = zxcvbn(password, userInputs);

  // Check if password meets minimum score requirement
  const isValid = result.score >= MINIMUM_PASSWORD_SCORE;

  // Build feedback
  const feedback = {
    warning: result.feedback.warning || undefined,
    suggestions: result.feedback.suggestions || [],
  };

  // Add custom suggestions based on score
  if (!isValid) {
    if (result.score === 0) {
      feedback.suggestions.unshift(
        'This password is too easy to guess. Try a passphrase with random words, numbers and symbols.'
      );
    } else if (result.score === 1) {
      feedback.suggestions.unshift(
        'This password needs to be stronger. Add more words, numbers, symbols or use a longer phrase.'
      );
    } else if (result.score === 2) {
      feedback.suggestions.unshift(
        'This password could be stronger. Try adding another word, numbers, symbols or using less common words.'
      );
    }
  }

  return {
    isValid,
    score: result.score,
    feedback,
    crackTime:
      result.crack_times_display.offline_slow_hashing_1e4_per_second.toString(),
  };
}

/**
 * Get a user-friendly error message for password validation failure
 *
 * @param result - The PasswordStrengthResult from validatePasswordStrength
 * @returns A formatted error message string
 */
export function getPasswordErrorMessage(
  result: PasswordStrengthResult
): string {
  const messages: string[] = [];

  if (result.feedback.warning) {
    messages.push(result.feedback.warning);
  }

  if (result.feedback.suggestions.length > 0) {
    messages.push(...result.feedback.suggestions);
  }

  return messages.join(' ');
}
