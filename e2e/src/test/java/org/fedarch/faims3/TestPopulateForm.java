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
 * Filename: TestPopulateFormInterface.java
 * Description:
 *   TODO
 */
package org.fedarch.faims3;

import java.net.MalformedURLException;

import org.fedarch.faims3.pages.AstroSkyMainPage;
import org.fedarch.faims3.pages.ProjectsPage;
import org.json.JSONException;
import org.openqa.selenium.WebDriver;
import org.testng.annotations.AfterClass;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Optional;
import org.testng.annotations.Parameters;
import org.testng.annotations.Test;

/**
 *  Test populate the fields on the app:
 *   https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 */
public class TestPopulateForm {

	protected AstroSkyMainPage astroSky;

	protected ProjectsPage projects;

	private WebDriver driver;

	// Test description
	private String description;


	@BeforeClass
	@Parameters({ "driver", "runLocally"})
	public void setup(String driverType, @Optional("false") boolean runLocally)
			throws MalformedURLException, JSONException {
		this.description = "Test create and save new AstroSky observation form ("
	        + driverType + ")";
	    this.driver = WebDriverFactory.createDriver(driverType, runLocally, description);
		this.projects = new ProjectsPage(driver);
		this.astroSky = new AstroSkyMainPage(driver);
		// always make sure auto increment id has a default range
		// if not, create one
        this.projects.checkAutoIncrement();
	}

	// Doable Task 2.1 - Observation creation
	// Doable Task 2.3 - GPS and Taking a Point
	/**
	 * This test scenario is when you put in all the mandatory fields correctly and
	 * then click submit successfully.
	 * Doable Task 2.1 - Observation creation
	 * Doable Task 2.3 - GPS and Taking a Point
	 * @throws Exception
	 */
	@Test
	public void testNewObservationWithGPS() throws Exception {
		try {
			// Start a new observation
			projects.loadNewAstroSkyForm();
			// The form should load up
			astroSky.fillOutFormWithValidFields();
			// validate JSON
			astroSky.validateJSON();
			// remember record id for next tests
			String recordId = astroSky.getRecordId();
			// Click save and new
			astroSky.submit();
			// Check the message
			astroSky.verifyMessage("Record successfully created");
			// return to the projects page
			astroSky.leaveObservationForm();
			// Load the just-created observation
			projects.loadObservationRecord(recordId);
			// Ensure that location and change are still present in the data
			astroSky.checkLatLongValues();
		} catch (Exception e) {
			TestUtils.markBrowserstackTestResult(driver, false,
					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
			throw e;
		} catch (AssertionError e) {
			TestUtils.markBrowserstackTestResult(driver, false,
					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
			throw e;
		}
		// if we make it to the end with no exceptions, that means we passed!
		TestUtils.markBrowserstackTestResult(driver, true,
				this.description + " passed!");
	}

	@AfterMethod
	@AfterClass
	public void tearDown() {
	    this.driver.quit();
	}


}
