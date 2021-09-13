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
 * Filename: TestStagingFormIOS.java
 * Description:
 *   TODO
 */
package org.fedarch.faims3.ios;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertTrue;

import java.lang.reflect.InvocationTargetException;
import java.net.MalformedURLException;
import java.util.List;

import org.fedarch.faims3.AstroSky;
import org.fedarch.faims3.TestStagingForm;
import org.fedarch.faims3.TestUtils;
import org.json.JSONException;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.testng.annotations.AfterClass;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.Test;

import io.appium.java_client.ios.IOSElement;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestStagingFormIOS extends IOSTest implements TestStagingForm {

  @BeforeClass
  public void setup() throws MalformedURLException, JSONException {
	  // Test with browserstack by default
	  // Change to true for local test connection
	  super.setup(false,  "Test staging new Test Project observation form (IOS)");
  }

  /**
   * This test scenario is when you put in all the mandatory fields and switch to another project on the top tab.
   * When you open the form again, it should have saved the previous values.
   *
   * @throws JSONException
   * @throws MalformedURLException
   * @throws NoSuchMethodException
   * @throws SecurityException
   * @throws IllegalAccessException
   * @throws IllegalArgumentException
   * @throws InvocationTargetException
   */
  @Override
@Test
  public void testSwitchTab() throws JSONException {
	  try {
			// Go to Test Project form
			loadNewAstroSkyForm();
			// Fill out all fields
			fillOutFormWithValidFields();
			TestUtils.scrollDown(driver);
			// validate JSON values
			validateJSON();

			// open the other project
			// driver.findElement(By.xpath("//*[@href='/projects']")).click();
//			WebDriverWait wait = new WebDriverWait(driver, 10);
//			wait.until(
//					ExpectedConditions.presenceOfElementLocated(
//							By.xpath("//*[@href='/projects/default_generated_oral_history']"))).click();

			// return to "Projects" and then reopen the form
			loadNewAstroSkyForm();
			// Check all fields are still the same
			validateLatLong();
			assertEquals(AstroSky.EMAIL_IOS, driver.findElement(By.id("email-field")).getAttribute("value"));

			TestUtils.scrollDown(driver);

			assertEquals(AstroSky.COLOUR, driver.findElement(By.id("str-field")).getAttribute("value"));
			assertEquals(AstroSky.UNICODE, driver.findElement(By.id("multi-str-field")).getAttribute("value"));

			TestUtils.scrollDown(driver);

			assertEquals(AstroSky.INTEGER, driver.findElement(By.id("int-field")).getAttribute("value"));
			assertEquals("Currency €", driver.findElement(By.id("select-field")).getAttribute("value"));
			assertEquals("Currencies $, €", driver.findElement(By.id("multi-select-field")).getAttribute("value"));
			assertEquals("true", driver.findElement(By.id("checkbox-field")).getAttribute("checked"));

			// radio button
		    List<IOSElement> radioButtons = driver.findElementsByXPath("//input[name='radio-group-field']");
			for (WebElement radioButton : radioButtons) {
				if (radioButton.getAttribute("value").equals("4")) {
					// the fourth radio button should be selected
					assertTrue(radioButton.isSelected());
				} else {
					assertFalse(radioButton.isSelected());
				}
			}

			TestUtils.scrollDown(driver);

			// Make sure JSON is still the same
			validateJSON();
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
	  TestUtils.markBrowserstackTestResult(driver, isUsingBrowserstack(), true, "IOS - TestStagingForm.testSwitchTab() passed!");
  }

  //TODO: switch via menu on the left
  @Override
@AfterClass
  public void tearDown() {
	 // The driver.quit statement is required, otherwise the test continues to execute, leading to a timeout.
	 super.tearDown();
  }
}
