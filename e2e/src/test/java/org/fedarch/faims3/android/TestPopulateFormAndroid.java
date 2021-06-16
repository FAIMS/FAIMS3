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
 * Filename: TestPopulateForm.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.android;

import java.net.MalformedURLException;

import org.fedarch.faims3.TestPopulateForm;
import org.fedarch.faims3.TestUtils;
import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestPopulateFormAndroid extends AndroidTest implements TestPopulateForm {

	@BeforeClass
	public static void setup() throws MalformedURLException {
		// Test with browserstack by default
		// Change to true for local test connection
		AndroidTest.setup(false, "Test populate new Test Project observation form (Android)");
	}

	/**
	 * This test scenario is when you put in all the mandatory fields correctly and
	 * then click submit successfully.
	 * @throws Exception
	 */
	@Test
	@Override
	public void testNoErrors() throws Exception {

		try {
			// Load up Astro Sky form
			super.loadNewAstroSkyForm();
			// The form should load up
			super.fillOutFormWithValidFields();
			TestUtils.scrollDown(driver);
			// validate JSON
			validateJSON();
			// Submit button
			WebElement submit = driver.findElement(By.xpath("//*[@text='SAVE AND NEW']"));
			submit.click();

		} catch (Exception e) {
			TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
					"Exception " + e.getClass().getSimpleName() + " occurs! See log for details.");
			throw e;
		} catch (AssertionError e) {
			TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), false,
					"Assertion Error: '" + e.getMessage() + "' occurs! See log for details.");
			throw e;
		}
		TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), true,
				"Android - TestPopulateForm.testNoErrors() passed!");
	}

	@AfterClass
	public static void tearDown() {
		AndroidTest.tearDown();
	}
}
