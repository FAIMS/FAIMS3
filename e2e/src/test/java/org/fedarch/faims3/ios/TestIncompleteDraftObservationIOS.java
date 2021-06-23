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
 * Filename: TestIncompleteDraftObservationIOS.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.ios;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.net.MalformedURLException;

import org.fedarch.faims3.AstroSky;
import org.fedarch.faims3.TestIncompleteDraftObservation;
import org.fedarch.faims3.TestUtils;
import org.json.JSONException;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.TimeoutException;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

/**
 * Doable Task 2.2 - Incomplete/Draft Observations
 * Relating to: FAIMS3-25: As a module developer, I want to be able to control when the record saves,
 * either in "google docs" style, or "push save button" style.DONE
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestIncompleteDraftObservationIOS extends IOSTest implements TestIncompleteDraftObservation {

	@BeforeClass
	public static void setup() throws MalformedURLException, JSONException {
		// Test with browserstack by default
		// Change to true for local test connection
		IOSTest.setup(false, "Test incomplete draft observation form (iOS)");
	}

	@AfterClass
	public static void tearDown() {
		IOSTest.tearDown();
	}

	@Override
	@Test
	public void testIncompleteDraft() throws Exception {
		try {
			//In Test Project “Astrosky” click + New Observation on both IOS and IOS.
			loadNewAstroSkyForm();

			//Enter a sample email address into the form:
			//draft-observation-IOS-testername@faims.edu.au on the IOS
			WebDriverWait wait = new WebDriverWait(driver, 10);
			WebElement emailField = wait.until(
			        ExpectedConditions.presenceOfElementLocated((By.id("email-field"))));
		    emailField.sendKeys(AstroSky.EMAIL_DRAFT_IOS);

			//Wait 2 seconds but do not click SAVE AND NEW
		    Thread.sleep(2000);

			//Note the blue box at the top of the form notifying
			//“✔ Draft last saved a few seconds ago DD Mmm dd hh:mm:ss GMT+1000 (AEST)”
			WebElement messages = wait.until(ExpectedConditions.presenceOfElementLocated(
					By.xpath("//*[@id='root']/div[3]/div[3]/div/form/div/div[1]/div/div/div[2]")));
			// Get the date only, as we can't get the exact time
			assertTrue(
					messages.getText().trim().startsWith(
							"Draft last saved a few seconds ago ".concat(TestUtils.getTodaysDate())));
			//Leave the observation entry form
		    WebElement projects = wait.until(ExpectedConditions.elementToBeClickable(
		    		By.xpath("//a[@href='/projects']")));
			projects.click();

			//Load a different observation and then return to the projects page
			try {
				WebElement anotherOb = wait.until(ExpectedConditions.presenceOfElementLocated(
					By.xpath("//*[@class='MuiDataGrid-row Mui-even']/div[2]")));
				anotherOb.click();

				//Click + New Observation
			    loadNewAstroSkyForm();
			} catch (TimeoutException e) {
				// there's no other observations found..
				// Find the '+' button for new observation
				WebElement newObservation = new WebDriverWait(driver, 10)
						.until(ExpectedConditions.elementToBeClickable(By.xpath("//a[@href='/projects/default_test_proj/new-observation']")));

				newObservation.click();
			}

			//Did your draft observation reappear?
		    assertEquals(AstroSky.EMAIL_DRAFT_IOS, driver.findElement(By.id("email-field")).getAttribute("value"));
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
	  TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), true, "IOS - TestIncompleteDraftObservationIOS.testIncompleteDraft() passed!");
  }
}
