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
 * Filename: LakeMungo.java
 * Description: 
 *   TODO
 */
 
package org.fedarch.faims3;

import static org.junit.Assert.assertEquals;

import java.util.List;

import org.fedarch.faims3.android.TestUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;

/**
 * Utilities and constants used in Lake Mungo test form
 * @author Rini Angreani, CSIRO
 */
public class LakeMungo {
    public static final String EMAIL = "jane.doe@csiro.au";
    public static final String COLOUR = "Pink";
    public static final String UNICODE = "いろはにほへとちりぬるを Pchnąć w tę łódź jeża lub ośm skrzyń fig จงฝ่าฟันพัฒนาวิชาการ    côté de l'alcôve ovoïde größeren";
    //public static final String INTEGER = "16";
	/**
	 * Fill out all fields in test Lake Mungo form with valid values.
	 * @param driver AndroidDriver
	 */
	public static void fillOutFormWithValidFields(AndroidDriver<AndroidElement> driver) {
		WebDriverWait wait = new WebDriverWait(driver, 10);
		// Test GPS point
		AndroidElement gpsPoint = (AndroidElement) wait.until(
		        ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@text='TAKE POINT']")));
		gpsPoint.click();
		// Make sure the point text has been updated
		wait.until(
		        ExpectedConditions.visibilityOfElementLocated(MobileBy.xpath("//*[@text='Lat: ']")));
		// now check that the point was captured
		validateLatLong(driver);

		// Click on Action button
	    // The value will be updated in JSON
		AndroidElement action = driver.findElement(MobileBy.xpath("//*[@text='ACTION!']"));
		action.click();

	    // Email field
	    AndroidElement emailField = driver.findElement(MobileBy.xpath("//*[@resource-id='email-field']"));
	    emailField.sendKeys(LakeMungo.EMAIL);

	    TestUtils.scrollDown(driver);

	    // Colour field
	    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
	    strField.sendKeys(LakeMungo.COLOUR);

	    // Text area - test unicode
	    AndroidElement textField = driver.findElement(MobileBy.xpath("//*[@resource-id='multi-str-field']"));
	    textField.sendKeys(LakeMungo.UNICODE);

	    TestUtils.scrollDown(driver);

	    //TODO:
	    //Since updating to appium 1.21.0 (to enable geolocation), this will not work anymore
	    // so we just use the default number for now. It's now expecting you to enter the numbers from the
	    // keyboard, which is not showing properly.
	    AndroidElement intField = driver.findElement(By.xpath("//*[@resource-id='int-field']"));
	    //intField.sendKeys(LakeMungo.INTEGER);

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
	 * @param driver
	 */
	public static void validateLatLong(AndroidDriver<AndroidElement> driver) {
		//in Android 10, the element class name is actually android.widget.TextView
		//but otherwise it's android.view.View
		//ideally there should be an id so it's nice and easy, but we work with what we've got
		// so we have to work out the class name and get the siblings
		String className = driver.findElementByXPath("//*[@text='Lat: ']").getAttribute("className");
		List<AndroidElement> gpsInfo = driver.findElementsByXPath("//*[@text='Lat: ']/../" + className);
		assertEquals(TestUtils.getLatitude(driver), gpsInfo.get(1).getText());
		assertEquals("; Long: ", gpsInfo.get(2).getText());
		assertEquals(TestUtils.getLongitude(driver), gpsInfo.get(3).getText());
	}

	/**
	 * Validate JSON at the end of the form with input values.
	 * @param driver Android driver
	 * @return True if JSON is valid, false otherwise.
	 * @throws JSONException
	 */
	public static boolean validateJSON(AndroidDriver<AndroidElement> driver) throws JSONException, AssertionError {
		// Find JSON
		WebDriverWait wait = new WebDriverWait(driver, 10);
		// wait for Submit to finish
		wait.until(ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@text='SUBMIT']")));
		AndroidElement json = (AndroidElement) wait.until(ExpectedConditions.visibilityOf(
				driver.findElement(MobileBy.xpath("//*[@text='SUBMIT']/following-sibling::android.view.View/android.view.View"))));
		JSONObject jsonObject = new JSONObject(json.getText());
		JSONObject values = jsonObject.getJSONObject("values");

		JSONObject gps = values.getJSONObject("take-point-field");
		assertEquals(TestUtils.getLatitude(driver), gps.get("latitude").toString());
	    assertEquals(TestUtils.getLongitude(driver), gps.get("longitude").toString());
		assertEquals("Change!", values.get("action-field").toString());
		assertEquals(EMAIL, values.get("email-field").toString());
        assertEquals(COLOUR, values.get("str-field").toString());
        assertEquals(UNICODE, values.get("multi-str-field").toString());
        assertEquals("1", values.get("int-field").toString());
        assertEquals("EUR", values.get("select-field").toString());
        assertEquals("[\"USD\",\"EUR\"]", values.get("multi-select-field").toString());
        assertEquals("true", values.get("checkbox-field").toString());
        assertEquals("4", values.get("radio-group-field").toString());
        // no errors
        assertEquals("{}", jsonObject.get("errors").toString());

	    return true;
	}
}
