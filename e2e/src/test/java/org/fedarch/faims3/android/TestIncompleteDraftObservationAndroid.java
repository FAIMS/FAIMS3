/*
 * Copyright 2021 Macquarie University
 *
 * Licensed under the Apache License Version 2.0 (the, "License");
 * you may not use, this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing software
 * distributed under the License is distributed on an "AS IS" BASIS
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND either express or implied.
 * See, the License, for the specific language governing permissions and
 * limitations under the License.
 *
 * Filename: TestIncompleteDraftObservationAndroid.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.android;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertTrue;

import java.net.MalformedURLException;

import org.fedarch.faims3.AstroSky;
import org.fedarch.faims3.TestIncompleteDraftObservation;
import org.fedarch.faims3.TestUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidElement;

/**
 * Doable Task 2.2 - Incomplete/Draft Observations
 * Relating to: FAIMS3-25: As a module developer, I want to be able to control when the record saves,
 * either in "google docs" style, or "push save button" style.
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestIncompleteDraftObservationAndroid extends AndroidTest implements TestIncompleteDraftObservation {

	@BeforeClass
	public void setup() throws MalformedURLException {
		// Test with browserstack by default
		// Change to true for local test connection
		super.setup(false, "Test incomplete draft observation form (Android)");
	}

	@Override
	@AfterClass
	public void tearDown() {
		super.tearDown();
	}

	@Override
	@Test
	public void testIncompleteDraft() throws Exception {
		try {
			//In Test Project “Astrosky” click + New Observation on both chrome and android.
			loadNewAstroSkyForm();

			//Enter a sample email address into the form:
			//draft-observation-android-testername@faims.edu.au on the android
			WebDriverWait wait = new WebDriverWait(driver, 10);
			AndroidElement emailField = TestUtils.scrollToResourceId(driver, "email-field");
		    emailField.sendKeys(AstroSky.EMAIL_DRAFT_ANDROID);

			//Wait 2 seconds but do not click SAVE AND NEW
		    Thread.sleep(2000);

			//Note the blue box at the top of the form notifying
			//“✔ Draft last saved a few seconds ago DD Mmm dd hh:mm:ss GMT+1000 (AEST)”
		    WebElement messages = wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(
		    		"//*[@text='TAKE POINT']/preceding-sibling::android.view.View/android.view.View[2]")));
		    // Clean the html spaces
		    String message = messages.getText().replace("\u00a0"," ").trim();
		    // We can only compare the date, as the time zone is different with browserstack
		    assertTrue(message.startsWith(
		    		"Draft last saved a few seconds ago ".concat(TestUtils.getTodaysDate())));

			//Leave the observation entry form
		    if (driver.findElementByXPath("//android.widget.Button[@text='Show path']").isDisplayed()) {
		    	driver.findElementByXPath("//android.widget.Button[@text='Show path']").click();
		    }
		    AndroidElement projects = (AndroidElement) wait.until(ExpectedConditions
					.elementToBeClickable(MobileBy.xpath("//android.widget.TextView[contains(@text, 'Projects')]")));
		    projects.click();

			//Load a different observation and then return to the projects page
			loadObservationForm(recordId);

			leaveObservationForm();
			//Click + New Observation
			AndroidElement menuButton = driver.findElement(
					MobileBy.xpath("//*[contains(@text, 'Astrosky')]/../android.view.View[3]/android.widget.Button"));
			menuButton.click();
			AndroidElement newButton = (AndroidElement) wait.until(ExpectedConditions.visibilityOfElementLocated(
					By.xpath("//*[contains(@text, 'New Observation')]")));
			newButton.click();

			//Did your draft observation reappear?
		    assertEquals(AstroSky.EMAIL_DRAFT_ANDROID, driver.findElement(MobileBy.xpath("//*[@resource-id='email-field']")).getText());
	  } catch (Exception e) {
	      TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
	    		  "Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
	      throw e;
	  } catch (AssertionError e) {
		  TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
				  "Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
	      throw e;
	  }
	  // if we make it to the end with no exceptions, that means we passed!
	  TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), true, "Android - TestIncompleteDraftObservationAndroid.testIncompleteDraft() passed!");
  }

}
