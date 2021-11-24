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
 * Filename: TestIncompleteDraftObservation
 * Description:
 *   TODO
 */
package org.fedarch.faims3;

import static org.testng.Assert.assertTrue;

import java.net.MalformedURLException;

import org.fedarch.faims3.pages.AstroSkyMainPage;
import org.fedarch.faims3.pages.ProjectsPage;
import org.json.JSONException;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.ios.IOSDriver;
/**
 * Doable Task 2.2 - Incomplete/Draft Observations
 * Relating to: FAIMS3-25: As a module developer, I want to be able to control when the record saves,
 * either in "google docs" style, or "push save button" style.
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestIncompleteDraftObservation {
//     protected AstroSkyMainPage astroSky;

// 	protected ProjectsPage projects;

// 	private WebDriver driver;

// 	private String description;

// 	@BeforeClass
// 	@Parameters({ "driver", "runLocally"})
// 	public void setup(String driverType, @Optional("false") boolean runLocally)
// 			throws MalformedURLException, JSONException {
// 		this.description = "\"Test incomplete draft observation form ("
// 	        + driverType + ")";
// 	    this.driver = WebDriverFactory.createDriver(driverType, runLocally, description);
// 		this.projects = new ProjectsPage(driver);
// 		this.astroSky = new AstroSkyMainPage(driver);
// 	}

// 	@AfterClass
// 	public void tearDown() {
// 		this.driver.quit();
// 	}

// 	@Test
// 	public void testIncompleteDraft() throws Exception {
// 		try {
// 			//In Test Project “Astrosky” click + New Observation on both chrome and android.
// 			projects.loadNewAstroSkyForm();
// 			//Enter a sample email address into the form:
// 			//draft-observation-android-testername@faims.edu.au on the android
// 			WebDriverWait wait = new WebDriverWait(driver, 10);
// 			WebElement emailField = TestUtils.scrollToId(driver, "email-field");
// 			if (driver instanceof AndroidDriver) {
// 		        emailField.sendKeys(AstroSkyMainPage.EMAIL_DRAFT_ANDROID);
// 			} else if (driver instanceof IOSDriver) {
// 				emailField.sendKeys(AstroSkyMainPage.EMAIL_DRAFT_IOS);
// 			} else {
// 				emailField.sendKeys(AstroSkyMainPage.EMAIL_DRAFT_CHROME);
// 			}

// 			//Wait 2 seconds but do not click SAVE AND NEW
// 		    Thread.sleep(2000);

// 			//Note the blue box at the top of the form notifying
// 			//“✔ Draft last saved a few seconds ago DD Mmm dd hh:mm:ss GMT+1000 (AEST)”
// 		    WebElement messages = wait.until(ExpectedConditions.presenceOfElementLocated(By.xpath(
// 		    		"//*[@text='TAKE POINT']/preceding-sibling::android.view.View/android.view.View[2]")));
// 		    // Clean the html spaces
// 		    String message = messages.getText().replace("\u00a0"," ").trim();
// 		    // We can only compare the date, as the time zone is different with browserstack
// 		    assertTrue(message.startsWith(
// 		    		"Draft last saved a few seconds ago ".concat(TestUtils.getTodaysDate())));
// 		    // Note draft id
// 		    String draftId = astroSky.getRecordId();

// 			//Leave the observation entry form
// 		    astroSky.leaveObservationForm();

// 			//Did your draft observation reappear?
// 			projects.loadObservationDraft(draftId);
// 		} catch (Exception e) {
// 			TestUtils.markBrowserstackTestResult(driver, false,
// 					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
// 			throw e;
// 		} catch (AssertionError e) {
// 			TestUtils.markBrowserstackTestResult(driver, false,
// 					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
// 			throw e;
// 		}
// 		// if we make it to the end with no exceptions, that means we passed!
// 		TestUtils.markBrowserstackTestResult(driver, true,
// 				this.description + " passed!");
//   }


}