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
 * Filename: AndroidTest.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.android;

import static org.junit.Assert.assertEquals;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;

import org.fedarch.faims3.AstroSky;
import org.fedarch.faims3.E2ETest;
import org.fedarch.faims3.TestUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.remote.AndroidMobileCapabilityType;

public class AndroidTest implements E2ETest {
	protected static AndroidDriver<AndroidElement> driver;

	private static boolean isLocal;

	/**
	 * Setup the AndroidDriver based on parameter.
	 * @param localTest If true, then we'll set up a local connection. Otherwise we'll set up a browserstack one.
	 * @param testDesc Test description for browserstack
	 * @return an AndroidDriver instance
	 * @throws MalformedURLException
	 */
	public static void setup(boolean localTest, String testDesc) throws MalformedURLException {
		DesiredCapabilities caps = new DesiredCapabilities();
		// allow location services
	    caps.setCapability(AndroidMobileCapabilityType.GPS_ENABLED, "true");
	    // allow everything else so we don't get permission popups
	    caps.setCapability(AndroidMobileCapabilityType.AUTO_GRANT_PERMISSIONS, "true");
	    // Use UIAutomator2 for devices higher than 7
	    caps.setCapability("automationName", "UiAutomator2");
		if (localTest) {
			localConnectionSetup(caps);
			isLocal = true;
		} else {
		    browserstackSetup(caps, testDesc);
		    isLocal = false;
		}
	}

	/**
	 * Localhost setup for Rini's machine.
	 * @throws MalformedURLException
	 */
	public static void localConnectionSetup(DesiredCapabilities caps) throws MalformedURLException {
	    caps.setCapability("platformName", "Android");
	    caps.setCapability("platformVersion", "10.0");
	    caps.setCapability("deviceName", "Android Emulator");
	    caps.setCapability("adbExecTimeout", "1200000");
	    caps.setCapability("app", "C:\\github\\FAIMS3\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk");

	    driver = new AndroidDriver<AndroidElement>(new URL("http://127.0.0.1:4723/wd/hub"), caps);
	}

	/**
	 * Browserstack setup for the test
	 * @param testDescription Test scenario. Link to JIRA if possible.
	 * @throws MalformedURLException
	 */
	public static void browserstackSetup(DesiredCapabilities caps, String testDescription) throws MalformedURLException {
	    caps.setCapability("project", "FAIMS3 - Android Tests");
	    caps.setCapability("build", "Alpha");
	    caps.setCapability("name", testDescription.concat(" : ").concat(TestUtils.getCommitMessage()));

	    // Specify device and os_version for testing
	    caps.setCapability("device", "Google Pixel 3");
	    caps.setCapability("os_version", "10.0");
	    // Latest Appium browserstack version with correct geolocation
	    caps.setCapability("browserstack.appium_version", "1.21.0");

	    caps.setCapability("app", System.getenv("app_url"));
	    caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
	    caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));

	    driver = new AndroidDriver<AndroidElement>(
	            new URL("http://hub.browserstack.com/wd/hub"), caps);

	}

	/**
	 * True if this is connected to Browserstack.
	 * @return
	 */
	@Override
	public boolean isUsingBrowserstack() {
		return !isLocal;
	}

	/**
	 * Load up new test Observation form
	 */
	@Override
	public void loadNewAstroSkyForm() {
		// Click on "Projects"
		AndroidElement projects = (AndroidElement) new WebDriverWait(driver, 10).until(ExpectedConditions
				.elementToBeClickable(MobileBy.xpath("//android.view.MenuItem[contains(@text, 'Projects')]")));
		projects.click();

		// Get the right project
		AndroidElement AstroSky = (AndroidElement) new WebDriverWait(driver, 10).until(ExpectedConditions
				.presenceOfElementLocated(MobileBy.xpath("//*[@text='Lake Mungo Archaeological Survey - 2018']")));
		// Find the '+' button
		AndroidElement newButton = (AndroidElement) AstroSky.findElement(
				By.xpath("../android.view.View[5]/android.widget.Button[contains(@text, 'NEW OBSERVATION')]"));
		newButton.click();
	}

	/**
	 * Fill out all fields in test AsTRoSkY form with valid values.
	 */
	@Override
	public void fillOutFormWithValidFields() {
		WebDriverWait wait = new WebDriverWait(driver, 10);
		// Test GPS point
		AndroidElement gpsPoint = (AndroidElement) wait.until(
		        ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@text='TAKE POINT']")));
		gpsPoint.click();
		// Make sure the point text has been updated
		wait.until(
		        ExpectedConditions.visibilityOfElementLocated(MobileBy.xpath("//*[@text='Lat: ']")));
		// now check that the point was captured
		validateLatLong();

		// Click on Action button
	    // The value will be updated in JSON
		AndroidElement action = driver.findElement(MobileBy.xpath("//*[@text='ACTION!']"));
		action.click();

	    // Email field
	    AndroidElement emailField = driver.findElement(MobileBy.xpath("//*[@resource-id='email-field']"));
	    emailField.sendKeys(AstroSky.EMAIL);

	    TestUtils.scrollDown(driver);

	    // Colour field
	    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
	    strField.sendKeys(AstroSky.COLOUR);

	    // Text area - test unicode
	    AndroidElement textField = driver.findElement(MobileBy.xpath("//*[@resource-id='multi-str-field']"));
	    textField.sendKeys(AstroSky.UNICODE);

	    TestUtils.scrollDown(driver);

	    //TODO:
	    //Since updating to appium 1.21.0 (to enable geolocation), this will not work anymore
	    // so we just use the default number for now. It's now expecting you to enter the numbers from the
	    // keyboard, which is not showing properly.
	    AndroidElement intField = driver.findElement(By.xpath("//*[@resource-id='int-field']"));
	    //intField.sendKeys(AstroSky.INTEGER);

	    // Currency field
	    AndroidElement currencyField = driver.findElement(MobileBy.xpath("//*[@resource-id='select-field']"));
	    currencyField.click();

	    // wait for list of currencies to load
	    AndroidElement currencyList = (AndroidElement) wait.until(
	    		ExpectedConditions.presenceOfElementLocated(MobileBy.className("android.widget.ListView")));
	    // choose the second value: Euro
	    currencyList.findElements(MobileBy.className("android.view.View")).get(1).click();

	    // Multiple currency field
	    AndroidElement multiCurrField = (AndroidElement) wait.until(
	            ExpectedConditions.elementToBeClickable(
	            		MobileBy.xpath("//*[@resource-id='multi-select-field']")));
	    multiCurrField.click();
	    // wait for the spinner overlay to disappear so we can see everything on the list
	    wait.until(ExpectedConditions.invisibilityOf(multiCurrField));
	    // choose first, second: $, Euro
	    List<WebElement> currencies = wait.until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
	    		MobileBy.xpath("//android.view.View/android.widget.ListView"),
	    		MobileBy.xpath("//android.view.View")));
	    currencies.get(0).click();
	    currencies.get(1).click();

	    // click on integer field above to hide the currency selection (would be covering the checkbox below)
	    intField.click();

	    // tick the checkbox
	    AndroidElement checkbox = (AndroidElement) wait.until(
	    		ExpectedConditions.visibilityOfElementLocated(MobileBy.xpath("//*[@resource-id='checkbox-field']")));
	    checkbox.click();

	    // radio button
	    List<WebElement> radioButtons = wait.until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
	    		MobileBy.xpath("//*[@resource-id='radio-group-field']"),
	    		MobileBy.xpath("//android.widget.RadioButton")));
	    // click the fourth one
	    radioButtons.get(3).click();
	}

	/**
	 * Validate the lat long values generated by "Take Point" button.
	 */
	@Override
	public void validateLatLong() {
		//in Android 10, the element class name is actually android.widget.TextView
		//but otherwise it's android.view.View
		//ideally there should be an id so it's nice and easy, but we work with what we've got
		// so we have to work out the class name and get the siblings
		String className = driver.findElement(By.xpath("//*[@text='Lat: ']")).getAttribute("className");
		List<AndroidElement> gpsInfo = driver.findElements(By.xpath("//*[@text='Lat: ']/../" + className));
		assertEquals(getLatitude(), gpsInfo.get(1).getText());
		assertEquals("; Long: ", gpsInfo.get(2).getText());
		assertEquals(getLongitude(), gpsInfo.get(3).getText());
	}

	@Override
	public String getLatitude() {
		return String.valueOf(driver.location().getLatitude());
	}

	@Override
	public String getLongitude() {
		return String.valueOf(driver.location().getLongitude());

	}

	/**
	 * Validate JSON at the end of the form with input values.
	 * @return True if JSON is valid, false otherwise.
	 * @throws JSONException
	 */
	@Override
	public void validateJSON() throws JSONException, AssertionError {
		// Find JSON
		WebDriverWait wait = new WebDriverWait(driver, 10);
		// wait for Submit to finish
		wait.until(ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@text='SUBMIT']")));
		WebElement json = wait.until(ExpectedConditions.visibilityOf(
				driver.findElement(MobileBy.xpath("//*[@text='SUBMIT']/following-sibling::android.view.View/android.view.View"))));
		JSONObject jsonObject = new JSONObject(json.getText());
		JSONObject values = jsonObject.getJSONObject("values");

		JSONObject gps = values.getJSONObject("take-point-field");
		assertEquals(getLatitude(), gps.get("latitude").toString());
	    assertEquals(getLongitude(), gps.get("longitude").toString());
		assertEquals("Change!", values.get("action-field").toString());
		assertEquals(AstroSky.EMAIL, values.get("email-field").toString());
        assertEquals(AstroSky.COLOUR, values.get("str-field").toString());
        assertEquals(AstroSky.UNICODE, values.get("multi-str-field").toString());
        assertEquals("1", values.get("int-field").toString());
        assertEquals("EUR", values.get("select-field").toString());
        assertEquals("[\"USD\",\"EUR\"]", values.get("multi-select-field").toString());
        assertEquals("true", values.get("checkbox-field").toString());
        assertEquals("4", values.get("radio-group-field").toString());
        // no errors
        assertEquals("{}", jsonObject.get("errors").toString());

	}

	public static void tearDown() {
		// The driver.quit statement is required, otherwise the test continues to
		// execute, leading to a timeout.
		driver.quit();
	}
}
