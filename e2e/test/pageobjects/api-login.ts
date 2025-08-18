import {$, $$} from '@wdio/globals';
import {Page} from './page.ts';

/**
 * Page object for the API login page (login.handlebars)
 */
class API_Login extends Page {
  public open() {
    return super.open('login');
  }

  /**
   * Page elements using data-testid and fallback selectors
   */
  get authHeader() {
    return $('[data-testid="auth-header"], .auth-header');
  }

  get welcomeTitle() {
    return $('[data-testid="auth-header"] h2, .auth-header h2');
  }

  get loginForm() {
    return $('[data-testid="login-form"], form[method="post"]');
  }

  get emailInput() {
    return $('[data-testid="email-input"], input[name="email"]');
  }

  get passwordInput() {
    return $('[data-testid="password-input"], input[name="password"]');
  }

  get loginSubmitButton() {
    return $('[data-testid="login-submit-button"], button[type="submit"]');
  }

  get forgotPasswordLink() {
    return $(
      '[data-testid="forgot-password-link"], a[href*="forgot-password"]'
    );
  }

  // Message elements
  get warningMessage() {
    return $('[data-testid="warning-message"], .alert-warning');
  }

  get successMessage() {
    return $('[data-testid="success-message"], .alert-success');
  }

  get emailError() {
    return $('[data-testid="email-error"]');
  }

  get passwordError() {
    return $('[data-testid="password-error"]');
  }

  get loginError() {
    return $('[data-testid="login-error"]');
  }

  // SSO elements
  get ssoOptions() {
    return $('[data-testid="sso-options"], .sso-options');
  }

  get divider() {
    return $('[data-testid="divider"], .divider');
  }

  get ssoProviders() {
    return $$('[data-testid*="sso-provider-"], .auth-button-outline');
  }

  // Hidden form fields
  get redirectInput() {
    return $('input[name="redirect"]');
  }

  get inviteIdInput() {
    return $('input[name="inviteId"]');
  }

  get actionInput() {
    return $('input[name="action"]');
  }

  /**
   * Actions
   */
  async login(email: string, password: string) {
    await this.emailInput.setValue(email);
    await this.passwordInput.setValue(password);
    await this.loginSubmitButton.click();
  }

  async enterEmail(email: string) {
    await this.emailInput.waitForDisplayed();
    await this.emailInput.setValue(email);
  }

  async enterPassword(password: string) {
    await this.passwordInput.waitForDisplayed();
    await this.passwordInput.setValue(password);
  }

  async clickLogin() {
    await this.loginSubmitButton.waitForClickable();
    await this.loginSubmitButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordLink.waitForClickable();
    await this.forgotPasswordLink.click();
  }

  async clickSsoProvider(providerId: string) {
    const provider = $(`[data-testid="sso-provider-${providerId}"]`);
    await provider.waitForClickable();
    await provider.click();
  }

  /**
   * Validation methods
   */
  async waitForPageLoad() {
    await this.authHeader.waitForDisplayed({timeout: 10000});
  }

  async isLoginFormDisplayed() {
    return await this.loginForm.isDisplayed();
  }

  async isSsoOptionsDisplayed() {
    return await this.ssoOptions.isDisplayed();
  }

  async isLocalAuthAvailable() {
    return await this.loginForm.isExisting();
  }

  async isSsoAvailable() {
    return await this.ssoOptions.isExisting();
  }

  async isDividerDisplayed() {
    return await this.divider.isDisplayed();
  }

  /**
   * Message checking methods
   */
  async hasWarningMessage() {
    return await this.warningMessage.isExisting();
  }

  async getWarningMessage() {
    if (await this.hasWarningMessage()) {
      return await this.warningMessage.getText();
    }
    return null;
  }

  async hasSuccessMessage() {
    return await this.successMessage.isExisting();
  }

  async getSuccessMessage() {
    if (await this.hasSuccessMessage()) {
      return await this.successMessage.getText();
    }
    return null;
  }

  async hasEmailError() {
    return await this.emailError.isExisting();
  }

  async getEmailError() {
    if (await this.hasEmailError()) {
      return await this.emailError.getText();
    }
    return null;
  }

  async hasPasswordError() {
    return await this.passwordError.isExisting();
  }

  async getPasswordError() {
    if (await this.hasPasswordError()) {
      return await this.passwordError.getText();
    }
    return null;
  }

  async hasLoginError() {
    return await this.loginError.isExisting();
  }

  async getLoginError() {
    if (await this.hasLoginError()) {
      return await this.loginError.getText();
    }
    return null;
  }

  /**
   * SSO provider methods
   */
  async getSsoProviderCount() {
    return await this.ssoProviders.length;
  }

  async getSsoProviderNames() {
    const providers = await this.ssoProviders;
    const names = [];
    for (const provider of providers) {
      const text = await provider.getText();
      names.push(text.replace('Continue with', '').trim());
    }
    return names;
  }

  async hasSsoProvider(providerId: string) {
    const provider = $(`[data-testid="sso-provider-${providerId}"]`);
    return await provider.isExisting();
  }

  /**
   * Form validation methods
   */
  async isEmailRequired() {
    const required = await this.emailInput.getAttribute('required');
    return required !== null;
  }

  async isPasswordRequired() {
    const required = await this.passwordInput.getAttribute('required');
    return required !== null;
  }

  async getEmailValue() {
    return await this.emailInput.getValue();
  }

  async getPasswordValue() {
    return await this.passwordInput.getValue();
  }

  /**
   * Hidden field methods for testing form state
   */
  async getRedirectValue() {
    if (await this.redirectInput.isExisting()) {
      return await this.redirectInput.getValue();
    }
    return null;
  }

  async getInviteIdValue() {
    if (await this.inviteIdInput.isExisting()) {
      return await this.inviteIdInput.getValue();
    }
    return null;
  }

  async getActionValue() {
    if (await this.actionInput.isExisting()) {
      return await this.actionInput.getValue();
    }
    return null;
  }

  /**
   * Comprehensive page verification
   */
  async verifyPageElements() {
    await expect(this.authHeader).toBeDisplayed({
      message: 'Auth header should be displayed',
    });

    await expect(this.welcomeTitle).toBeDisplayed({
      message: 'Welcome title should be displayed',
    });

    // Check if local auth is available
    if (await this.isLocalAuthAvailable()) {
      await expect(this.emailInput).toBeDisplayed({
        message: 'Email input should be displayed when local auth is available',
      });

      await expect(this.passwordInput).toBeDisplayed({
        message:
          'Password input should be displayed when local auth is available',
      });

      await expect(this.loginSubmitButton).toBeDisplayed({
        message:
          'Login submit button should be displayed when local auth is available',
      });
    }

    // Check if SSO is available
    if (await this.isSsoAvailable()) {
      await expect(this.ssoOptions).toBeDisplayed({
        message:
          'SSO options should be displayed when SSO providers are available',
      });
    }

    // Check if both are available (divider should be present)
    if ((await this.isLocalAuthAvailable()) && (await this.isSsoAvailable())) {
      await expect(this.divider).toBeDisplayed({
        message:
          'Divider should be displayed when both local auth and SSO are available',
      });
    }
  }
}

export default new API_Login();
