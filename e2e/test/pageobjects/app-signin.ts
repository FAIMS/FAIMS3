import {$} from '@wdio/globals';
import Page from './page.js';

/**
 * Page object for the Fieldmark login/onboarding screen
 */
class LoginPage extends Page {
  public open() {
    return super.open('signin');
  }

  /**
   * Define page elements using data-testid and other selectors
   */
  get onboardingContainer() {
    return $('[data-testid="onboarding-component"]');
  }

  get appTitle() {
    return $('h1'); // The Typography component with APP_NAME
  }

  get signInButton() {
    return $('button*=Sign in'); // Button containing "Sign in" text
  }

  get enterCodeButton() {
    return $('button*=Enter code'); // Button containing "Enter code" text
  }

  get qrCodeButton() {
    return $('button*=QR'); // QR code button (if present)
  }

  get orDividerText() {
    return $('*=- or -'); // Divider text
  }

  get shortCodeInput() {
    return $('[data-testid="short-code-only"]'); // Input for short code
  }

  /**
   * Page actions
   */
  async clickSignIn() {
    await this.signInButton.waitForClickable();
    await this.signInButton.click();
  }

  async clickEnterCode() {
    await this.enterCodeButton.waitForClickable();
    await this.enterCodeButton.click();
  }

  async clickQrCode() {
    if (await this.qrCodeButton.isExisting()) {
      await this.qrCodeButton.waitForClickable();
      await this.qrCodeButton.click();
    }
  }

  /**
   * Wait for the page to be loaded
   */
  async waitForPageLoad() {
    await this.onboardingContainer.waitForDisplayed({timeout: 10000});
    await this.appTitle.waitForDisplayed();
  }

  /**
   * Check if the page is displayed correctly
   */
  async isPageDisplayed() {
    return (
      (await this.onboardingContainer.isDisplayed()) &&
      (await this.appTitle.isDisplayed()) &&
      (await this.signInButton.isDisplayed())
    );
  }

  /**
   * Get the app title text
   */
  async getAppTitle() {
    return await this.appTitle.getText();
  }

  /**
   * Check if QR code functionality is available (mobile platforms)
   */
  async isQrCodeAvailable() {
    return await this.qrCodeButton.isExisting();
  }

  /**
   * Verify all expected elements are present
   */
  async verifyPageElements() {
    const elements = [
      {element: this.onboardingContainer, name: 'Onboarding container'},
      {element: this.appTitle, name: 'App title'},
      {element: this.signInButton, name: 'Sign in button'},
      {element: this.enterCodeButton, name: 'Enter code button'},
    ];

    for (const {element, name} of elements) {
      await expect(element).toBeDisplayed({
        message: `${name} should be displayed`,
      });
    }
  }
}

export default new LoginPage();
