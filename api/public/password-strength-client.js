/**
 * Password Strength Client-side Implementation
 *
 * This script should be loaded on pages with password inputs (register, reset, change password)
 * It requires zxcvbn.js to be loaded first
 */

(function () {
  'use strict';

  // Configuration
  const MINIMUM_SCORE = 3;
  const MINIMUM_LENGTH = 10;

  // Score labels and colors
  const SCORE_CONFIG = {
    0: {label: 'Very weak', color: '#dc3545', class: 'strength-very-weak'},
    1: {label: 'Weak', color: '#fd7e14', class: 'strength-weak'},
    2: {label: 'Fair', color: '#ffc107', class: 'strength-fair'},
    3: {label: 'Good', color: '#28a745', class: 'strength-good'},
    4: {label: 'Strong', color: '#198754', class: 'strength-strong'},
  };

  /**
   * Creates and returns a strength meter element
   */
  function createStrengthMeter() {
    const container = document.createElement('div');
    container.className = 'password-strength-meter';
    container.innerHTML = `
      <div class="strength-bar-container">
        <div class="strength-bar" id="strengthBar"></div>
      </div>
      <div class="strength-feedback">
        <span class="strength-label" id="strengthLabel"></span>
        <span class="strength-time" id="strengthTime"></span>
      </div>
      <div class="strength-suggestions" id="strengthSuggestions"></div>
    `;
    return container;
  }

  /**
   * Updates the strength meter display
   */
  function updateStrengthMeter(password, userInputs = []) {
    const bar = document.getElementById('strengthBar');
    const label = document.getElementById('strengthLabel');
    const time = document.getElementById('strengthTime');
    const suggestions = document.getElementById('strengthSuggestions');

    if (!password || password.length === 0) {
      // Reset when empty
      bar.style.width = '0%';
      bar.style.backgroundColor = '';
      label.textContent = '';
      time.textContent = '';
      suggestions.textContent = '';
      return;
    }

    // Check minimum length first
    if (password.length < MINIMUM_LENGTH) {
      const config = SCORE_CONFIG[0];
      bar.style.width = '20%';
      bar.style.backgroundColor = config.color;
      label.textContent = config.label;
      label.className = 'strength-label ' + config.class;
      time.textContent = '';
      suggestions.innerHTML = `<span class="text-danger">Password must be at least ${MINIMUM_LENGTH} characters long</span>`;
      return;
    }

    // Use zxcvbn to analyze
    if (typeof zxcvbn === 'undefined') {
      console.error('zxcvbn library not loaded');
      return;
    }

    const result = zxcvbn(password, userInputs);
    const config = SCORE_CONFIG[result.score];

    // Update bar
    const widthPercent = ((result.score + 1) / 5) * 100;
    bar.style.width = widthPercent + '%';
    bar.style.backgroundColor = config.color;

    // Update label
    label.textContent = config.label;
    label.className = 'strength-label ' + config.class;

    // Update crack time
    const crackTime =
      result.crack_times_display.offline_slow_hashing_1e4_per_second;
    time.textContent = `Time to crack: ${crackTime}`;

    // Update suggestions
    const feedback = [];

    if (result.score < MINIMUM_SCORE) {
      feedback.push(
        '<span class="text-warning">⚠ This password is not strong enough</span>'
      );
    }

    if (result.feedback.warning) {
      feedback.push(
        `<span class="text-info">${result.feedback.warning}</span>`
      );
    }

    if (result.feedback.suggestions && result.feedback.suggestions.length > 0) {
      result.feedback.suggestions.forEach(suggestion => {
        feedback.push(`<span class="text-muted">• ${suggestion}</span>`);
      });
    }

    suggestions.innerHTML = feedback.join('<br>');
  }

  /**
   * Initialize password strength checking on a password input
   */
  function initPasswordStrength(passwordInput, userInputsGetter) {
    // Create and insert strength meter
    const meter = createStrengthMeter();
    passwordInput.parentNode.insertBefore(meter, passwordInput.nextSibling);

    // Add input event listener
    passwordInput.addEventListener('input', function () {
      const userInputs = userInputsGetter ? userInputsGetter() : [];
      updateStrengthMeter(this.value, userInputs);
    });
  }

  /**
   * Get user inputs for penalizing passwords that contain personal info
   */
  function getUserInputs() {
    const inputs = [];

    const emailInput = document.getElementById('EmailInput');
    if (emailInput && emailInput.value) {
      inputs.push(emailInput.value);
      // Also add the part before @
      const emailPart = emailInput.value.split('@')[0];
      if (emailPart) inputs.push(emailPart);
    }

    const nameInput = document.getElementById('NameInput');
    if (nameInput && nameInput.value) {
      inputs.push(nameInput.value);
      // Also add individual name parts
      nameInput.value.split(/\s+/).forEach(part => {
        if (part) inputs.push(part);
      });
    }

    return inputs;
  }

  /**
   * Initialize on page load
   */
  function init() {
    // Register page
    const registerPassword = document.getElementById('InputPassword');
    if (registerPassword) {
      initPasswordStrength(registerPassword, getUserInputs);
    }

    // Reset password page
    const resetPassword = document.getElementById('NewPassword');
    if (resetPassword) {
      initPasswordStrength(resetPassword, () => []);
    }

    // Change password page
    const changePassword = document.getElementById('newPassword');
    if (changePassword) {
      const usernameInput = document.querySelector('input[name="username"]');
      initPasswordStrength(changePassword, () => {
        return usernameInput && usernameInput.value
          ? [usernameInput.value]
          : [];
      });
    }
  }

  // Wait for zxcvbn to load, then initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      // Give zxcvbn a moment to load if it's async
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

  // Also check password match across different pages
  var matchConfigs = [
    // Register page
    {password: 'InputPassword', confirm: 'RepeatPassword'},
    // Reset password page
    {password: 'NewPassword', confirm: 'ConfirmPassword'},
    // Change password page
    {password: 'newPassword', confirm: 'confirmPassword'},
  ];

  matchConfigs.forEach(function (cfg) {
    var password = document.getElementById(cfg.password);
    var confirm = document.getElementById(cfg.confirm);
    if (!password || !confirm) return;

    // Create feedback element if it doesn't exist
    var feedback = document.getElementById('passwordMatchFeedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.id = 'passwordMatchFeedback';
      feedback.className = 'password-match-feedback';
      confirm.parentNode.insertBefore(feedback, confirm.nextSibling);
    }

    function checkMatch() {
      var pw = password.value;
      var cp = confirm.value;
      if (!pw || !cp) {
        feedback.textContent = '';
        feedback.className = 'password-match-feedback';
        return;
      }
      if (pw === cp) {
        feedback.textContent = '\u2713 Passwords match';
        feedback.className = 'password-match-feedback text-success';
      } else {
        feedback.textContent = '\u2717 Passwords do not match';
        feedback.className = 'password-match-feedback text-danger';
      }
    }
    password.addEventListener('input', checkMatch);
    confirm.addEventListener('input', checkMatch);
  });
})();
