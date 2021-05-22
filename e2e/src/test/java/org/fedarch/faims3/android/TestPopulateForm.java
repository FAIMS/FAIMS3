package org.fedarch.faims3.android;

import java.net.MalformedURLException;

import org.fedarch.faims3.LakeMungo;

import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidElement;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestPopulateForm extends AndroidTest {

  @BeforeClass
  public static void setup() throws MalformedURLException {
	  // Test with browserstack by default
	  // Change to true for local test connection
	  AndroidTest.setup(false, "FAIMS3-153: Test Data Entry - Android");
  }

  /**
   * This test scenario is when you put in all the mandatory fields correctly and then click submit successfully.
   */
  @Test
  public void testNoErrors() {
      try {
			// Load up Lake Mungo form
			TestUtils.loadPreviousDevContent(driver);
			// The form should load up
			LakeMungo.fillOutFormWithValidFields(driver);
			TestUtils.scrollDown(driver);
			// Submit button
			AndroidElement submit = driver.findElement(By.xpath("//*[@text='SUBMIT']"));
			submit.click();
			// validate JSON
			if(!LakeMungo.validateJSON(driver)) {
				TestUtils.markBrowserstackTestResult(driver, false, "Android - TestPopulateForm.testNoErrors() failed because JSON values don't match!");
				return;
			}
	  } catch (Exception e) {
	      TestUtils.markBrowserstackTestResult(driver, false, "Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
	      throw e;
	  }
      TestUtils.markBrowserstackTestResult(driver, true, "Android - TestPopulateForm.testNoErrors() passed!");
  }
  
  @AfterClass
  public static void tearDown() {
	 // The driver.quit statement is required, otherwise the test continues to execute, leading to a timeout.
	 driver.quit();
  }
}