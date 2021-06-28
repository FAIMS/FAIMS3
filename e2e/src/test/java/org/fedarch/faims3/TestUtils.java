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
 * Filename: TestUtils.java
 * Description:
 *   TODO
 */
package org.fedarch.faims3;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Map;

import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.remote.RemoteWebDriver;

import io.appium.java_client.MobileBy;
import io.appium.java_client.TouchAction;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.touch.offset.PointOption;

/**
 * Utility class for reusable methods across tests.
 * @author Rini Angreani, CSIRO
 *
 */
public class TestUtils {
	/**
	 * Scroll down a little bit at a time.
	 * @param driver AndroidDriver
	 */
	public static void scrollDown(WebDriver driver) {
		//if pressX was zero it didn't work for me
	    int pressX = driver.manage().window().getSize().width / 2;
	    // 4/5 of the screen as the bottom finger-press point
	    int bottomY = driver.manage().window().getSize().height * 4/5;
	    // just non zero point, as it didn't scroll to zero normally
	    int topY = driver.manage().window().getSize().height / 8;
	    //scroll with TouchAction by itself
	    TestUtils.scroll(driver, pressX, bottomY, pressX, topY);
	}

	/**
	 * Scroll up a little bit at a time.
	 * @param driver AndroidDriver
	 */
	public static void scrollUp(AndroidDriver<AndroidElement> driver) {
		//if pressX was zero it didn't work for me
	    int pressX = driver.manage().window().getSize().width / 2;
	    // 4/5 of the screen as the bottom finger-press point
	    int topY = driver.manage().window().getSize().height * 4/5;
	    // just non zero point, as it didn't scroll to zero normally
	    int bottomY = driver.manage().window().getSize().height / 8;
	    //scroll with TouchAction by itself
	    TestUtils.scroll(driver, pressX, bottomY, pressX, topY);
	}

    /**
     * Generic scroll method.
     * @param driver Android driver
     * @param fromX Scroll horizontal starting point
     * @param fromY Scroll vertical starting point
     * @param toX Scroll horizontal destination point
     * @param toY Scroll vertical destination point
     */
	public static void scroll(WebDriver driver, int fromX, int fromY, int toX, int toY) {
		if (driver instanceof AndroidDriver) {
	        TouchAction touchAction = new TouchAction((AndroidDriver)driver);
	        touchAction.longPress(PointOption.point(fromX, fromY)).moveTo(PointOption.point(toX, toY)).release().perform();
		} else if (driver instanceof RemoteWebDriver) {
			JavascriptExecutor js = (JavascriptExecutor) driver;
			js.executeScript("window.scrollBy(0," + (fromY - toY) + ")", "");
		} else {
			// TODO: implement ios support if needed
			throw new UnsupportedOperationException("IOS scroll() isn't supported yet!");
		}
	}

	/**
	 * Scroll to an element by text
	 * @param driver
	 * @param elementText The text on the element to be found
	 */
	public static AndroidElement scrollToText(AndroidDriver<AndroidElement> driver, String elementText) {
	    return driver.findElement(MobileBy.AndroidUIAutomator("new UiScrollable(new UiSelector()).scrollIntoView("
            + "new UiSelector().text(\"" + elementText + "\"));"));
	}

	/**
	 * Scroll to an element by resource id
	 * @param driver
	 * @param resourceId Resource id on the element to be found
	 */
	public static AndroidElement scrollToResourceId(AndroidDriver<AndroidElement> driver, String resourceId) {
	    return driver.findElement(MobileBy.AndroidUIAutomator("new UiScrollable(new UiSelector()).scrollIntoView("
            + "new UiSelector().resourceIdMatches(\"" + resourceId + "\"));"));
	}

	/**
	 * Browserstack doesn't know when an assertion fail. We need to explicitly let it know.
	 * https://www.browserstack.com/docs/automate/selenium/view-test-results/mark-tests-as-pass-fail#mark-test-status-from-the-test-script-using-javascriptexecutor
	 * @param driver AndroidDriver
	 * @param passed True if the test passed. False otherwise.
	 * @param message Reason it passed/failed.
	 */
	public static void markBrowserstackTestResult(WebDriver driver, boolean isBrowserstackConnected, boolean passed, String message) {
		if (!isBrowserstackConnected) {
			// only for browserstack
			return;
		}
	    JavascriptExecutor jse = (JavascriptExecutor) driver;
	    // Setting the status of test as 'passed' or 'failed' based on the condition
	    if (passed) {
	        jse.executeScript("browserstack_executor: {\"action\": \"setSessionStatus\", \"arguments\": {\"status\": \"passed\", \"reason\": \"" + message + "\"}}");
	    } else {
	        jse.executeScript("browserstack_executor: {\"action\": \"setSessionStatus\", \"arguments\": {\"status\":\"failed\", \"reason\": \"" + message + "\"}}");
	    }
	}

	/**
	 * Get commit message for browserstack. Defaults to "manual run".
	 * @return
	 */
	public static String getCommitMessage() {
	    //Set commit message as session name
	    String description = System.getenv("BROWSERSTACK_BUILD_NAME");
	    if (description == null || description.isEmpty()) {
	    	description = "Manual run";
	    }
	    return description;
	}

	public static boolean isUsingBrowserstack(WebDriver driver) {
		// TODO Auto-generated method stub
		return false;
	}

	/**
	 * Get today's date in the DD Mmm dd format
	 * @return
	 */
	public static String getTodaysDate() {
		SimpleDateFormat dateFormat = new SimpleDateFormat("EEE MMM dd yyyy");
		Date date = new Date();
		return dateFormat.format(date);
	}

	/**
	 * Get environment variable of current process
	 * @return
	 * @throws Exception
	 */
	@SuppressWarnings("unchecked")
	protected static Map<String, String> getModifiableEnvironment() throws Exception
	{
	    Class<?> pe = Class.forName("java.lang.ProcessEnvironment");
	    Method getenv = pe.getDeclaredMethod("getenv", String.class);
	    getenv.setAccessible(true);
	    Field props = pe.getDeclaredField("theCaseInsensitiveEnvironment");
	    props.setAccessible(true);
	    return (Map<String, String>) props.get(null);
	}
}