import {$, $$} from '@wdio/globals';
import {Page} from './page';

/**
 * Page object for the API register page (register.handlebars)
 */
class API_Register extends Page {
  public open() {
    return super.open('register');
  }

  /**
   * Page elements using data-testid and fallback selectors
   */
  get authHeader() {
    return $('[data-testid="auth-header"], .auth-header');
  }

  get createAccountTitle() {
    return $('[data-testid="auth-header"] h2, .auth-header h2');
  }

  get loginLink() {
    return $('[data-testid="login-link"], .auth-link');
  }

  get registerForm() {
    return $('[data-testid="register-form"], form[method="post"]');
  }

  get emailInput() {
    return $('[data-testid="email-input"], input[name="email"]');
  }

  get nameInput() {
    return $('[data-testid="name-input"], input[name="name"]');
  }

  get passwordInput() {
    return $('[data-testid="password-input"], input[name="password"]');
  }

  get confirmPasswordInput() {
    return $('[data-testid="confirm-password-input"], input[name="repeat"]');
  }

  get passwordHelper() {
    return $('[data-testid="password-helper"], .helper-text');
  }

  get registerSubmitButton() {
    return $('[data-testid="register-submit-button"], button[type="submit"]');
  }

  // Error message elements
  get registrationError() {
    return $('[data-testid="registration-error"]');
  }

  get emailError() {
    return $('[data-testid="email-error"]');
  }

  get nameError() {
    return $('[data-testid="name-error"]');
  }

  get passwordError() {
    return $('[data-testid="password-error"]');
  }

  get confirmPasswordError() {
    return $('[data-testid="confirm-password-error"]');
  }

  get registrationSubmitError() {
    return $('[data-testid="registration-submit-error"]');
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
  async register(
    email: string,
    name: string,
    password: string,
    confirmPassword: string
  ) {
    await this.emailInput.setValue(email);
    await this.nameInput.setValue(name);
    await this.passwordInput.setValue(password);
    await this.confirmPasswordInput.setValue(confirmPassword);
    await this.registerSubmitButton.click();
  }

  async enterEmail(email: string) {
    await this.emailInput.waitForDisplayed();
    await this.emailInput.setValue(email);
  }

  async enterName(name: string) {
    await this.nameInput.waitForDisplayed();
    await this.nameInput.setValue(name);
  }

  async enterPassword(password: string) {
    await this.passwordInput.waitForDisplayed();
    await this.passwordInput.setValue(password);
  }

  async enterConfirmPassword(confirmPassword: string) {
    await this.confirmPasswordInput.waitForDisplayed();
    await this.confirmPasswordInput.setValue(confirmPassword);
  }

  async clickRegister() {
    await this.registerSubmitButton.waitForClickable();
    await this.registerSubmitButton.click();
  }

  async clickLoginLink() {
    await this.loginLink.waitForClickable();
    await this.loginLink.click();
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

  async isRegisterFormDisplayed() {
    return await this.registerForm.isDisplayed();
  }

  async isSsoOptionsDisplayed() {
    return await this.ssoOptions.isDisplayed();
  }

  async isLocalAuthAvailable() {
    return await this.registerForm.isExisting();
  }

  async isSsoAvailable() {
    return await this.ssoOptions.isExisting();
  }

  async isDividerDisplayed() {
    return await this.divider.isDisplayed();
  }

  /**
   * Error message checking methods
   */
  async hasRegistrationError() {
    return await this.registrationError.isExisting();
  }

  async getRegistrationError() {
    if (await this.hasRegistrationError()) {
      return await this.registrationError.getText();
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

  async hasNameError() {
    return await this.nameError.isExisting();
  }

  async getNameError() {
    if (await this.hasNameError()) {
      return await this.nameError.getText();
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

  async hasConfirmPasswordError() {
    return await this.confirmPasswordError.isExisting();
  }

  async getConfirmPasswordError() {
    if (await this.hasConfirmPasswordError()) {
      return await this.confirmPasswordError.getText();
    }
    return null;
  }

  async hasRegistrationSubmitError() {
    return await this.registrationSubmitError.isExisting();
  }

  async getRegistrationSubmitError() {
    if (await this.hasRegistrationSubmitError()) {
      return await this.registrationSubmitError.getText();
    }
    return null;
  }

  /**
   * Form validation methods
   */
  async isEmailRequired() {
    const required = await this.emailInput.getAttribute('required');
    return required !== null;
  }

  async isNameRequired() {
    const required = await this.nameInput.getAttribute('required');
    return required !== null;
  }

  async isPasswordRequired() {
    const required = await this.passwordInput.getAttribute('required');
    return required !== null;
  }

  async isConfirmPasswordRequired() {
    const required = await this.confirmPasswordInput.getAttribute('required');
    return required !== null;
  }

  async getEmailValue() {
    return await this.emailInput.getValue();
  }

  async getNameValue() {
    return await this.nameInput.getValue();
  }

  async getPasswordValue() {
    return await this.passwordInput.getValue();
  }

  async getConfirmPasswordValue() {
    return await this.confirmPasswordInput.getValue();
  }

  async getPasswordHelperText() {
    return await this.passwordHelper.getText();
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
   * Form validation helper methods
   */
  async clearAllFields() {
    await this.emailInput.clearValue();
    await this.nameInput.clearValue();
    await this.passwordInput.clearValue();
    await this.confirmPasswordInput.clearValue();
  }

  async fillRegistrationForm(
    email: string,
    name: string,
    password: string,
    confirmPassword?: string
  ) {
    await this.enterEmail(email);
    await this.enterName(name);
    await this.enterPassword(password);
    await this.enterConfirmPassword(confirmPassword || password);
  }

  /**
   * Comprehensive page verification
   */
  async verifyPageElements() {
    await expect(this.authHeader).toBeDisplayed({
      message: 'Auth header should be displayed',
    });

    await expect(this.createAccountTitle).toBeDisplayed({
      message: 'Create account title should be displayed',
    });

    await expect(this.loginLink).toBeDisplayed({
      message: 'Login link should be displayed',
    });

    // Check if local auth is available
    if (await this.isLocalAuthAvailable()) {
      await expect(this.emailInput).toBeDisplayed({
        message: 'Email input should be displayed when local auth is available',
      });

      await expect(this.nameInput).toBeDisplayed({
        message: 'Name input should be displayed when local auth is available',
      });

      await expect(this.passwordInput).toBeDisplayed({
        message:
          'Password input should be displayed when local auth is available',
      });

      await expect(this.confirmPasswordInput).toBeDisplayed({
        message:
          'Confirm password input should be displayed when local auth is available',
      });

      await expect(this.registerSubmitButton).toBeDisplayed({
        message:
          'Register submit button should be displayed when local auth is available',
      });

      await expect(this.passwordHelper).toBeDisplayed({
        message: 'Password helper text should be displayed',
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

  /**
   * Password validation helper
   */
  async validatePasswordMatch() {
    const password = await this.getPasswordValue();
    const confirmPassword = await this.getConfirmPasswordValue();
    return password === confirmPassword;
  }

  /**
   * Check if email is pre-populated (from messages.email)
   */
  async hasPrePopulatedEmail() {
    const emailValue = await this.getEmailValue();
    return emailValue !== '';
  }

  /**
   * Check if name is pre-populated (from messages.name)
   */
  async hasPrePopulatedName() {
    const nameValue = await this.getNameValue();
    return nameValue !== '';
  }
}

export default new API_Register();
