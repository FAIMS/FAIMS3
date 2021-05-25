package org.fedarch.faims3.android;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

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
	 * Scroll down until condition is satisfied.
	 * @param condition Condition to satisfy
	 * @param driver AndroidDriver
	 */
	public static AndroidElement scrollDownUntilVisible(By condition, AndroidDriver<AndroidElement> driver) {
		return TestUtils.scrollDownUntilVisible(condition, driver, 0);
	}
	/**
	 * Scroll down until condition is satisfied.
	 * @param condition Condition to satisfy
	 * @param driver AndroidDriver
	 * @param count The number of times the scroll has been done.
	 */
	private static AndroidElement scrollDownUntilVisible(By condition, AndroidDriver<AndroidElement> driver, int count) {
		AndroidElement element = null;
		try {
		    element = driver.findElement(condition);
	    } catch (NoSuchElementException e) {
	    	// Element not visible. Catch error, scroll down and try again
	    	// Ugly, I know.. but there are no other ways!
	    	TestUtils.scrollDown(driver);
	    	count++;
	    	if (count < 5) {
	    		// Try to fail fast rather than waiting for timeout if we keep scrolling in the same spot
	    	    element = TestUtils.scrollDownUntilVisible(condition, driver, count);
	    	} else {
	    		throw e;
	    	}
	    }
		return element;
	}
	/**
	 * Scroll down a little bit at a time.
	 * @param driver AndroidDriver
	 */
	public static void scrollDown(AndroidDriver<AndroidElement> driver) {
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
	 * Scroll down until condition is satisfied.
	 * @param condition Condition to satisfy
	 * @param driver AndroidDriver
	 */
	public static AndroidElement scrollUpUntilVisible(By condition, AndroidDriver<AndroidElement> driver) {
		return TestUtils.scrollUpUntilVisible(condition, driver, 0);
	}
	/**
	 * Scroll up until condition is satisfied.
	 * @param condition Condition to satisfy
	 * @param driver AndroidDriver
	 * @param count How many times the scroll has been performed
	 */
	public static AndroidElement scrollUpUntilVisible(By condition, AndroidDriver<AndroidElement> driver, int count) {
		AndroidElement element = null;
		try {
		    element = driver.findElement(condition);
	    } catch (NoSuchElementException e) {
	    	// Element not visible. Catch error, scroll down and try again
	    	// Ugly, I know.. but there are no other ways!
	    	TestUtils.scrollUp(driver);
	    	count++;
	    	if (count < 5) {
	    		// Try to fail fast rather than waiting for timeout if we keep scrolling in the same spot
	    	    element = TestUtils.scrollUpUntilVisible(condition, driver, count);
	    	} else {
	    		throw e;
	    	}
	    }
		return element;
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
	public static void scroll(AndroidDriver<AndroidElement> driver, int fromX, int fromY, int toX, int toY) {
	    TouchAction touchAction = new TouchAction(driver);
	    touchAction.longPress(PointOption.point(fromX, fromY)).moveTo(PointOption.point(toX, toY)).release().perform();
	}

	/**
	 * Click on "Previous Dev Content" on the landing page.
	 *
	 * @param driver AndroidDriver
	 */
	public static void loadPreviousDevContent(AndroidDriver<AndroidElement> driver) {
		// Click on "Previous dev content"
		AndroidElement prevDev = (AndroidElement) new WebDriverWait(driver, 10).until(
			        ExpectedConditions.elementToBeClickable(MobileBy.xpath ("//*[contains(@text, 'Previous dev content')]")));
		prevDev.click();
	}


	/**
	 * Browserstack doesn't know when an assertion fail. We need to explicitly let it know.
	 * https://www.browserstack.com/docs/automate/selenium/view-test-results/mark-tests-as-pass-fail#mark-test-status-from-the-test-script-using-javascriptexecutor
	 * @param driver AndroidDriver
	 * @param passed True if the test passed. False otherwise.
	 * @param message Reason it passed/failed.
	 */
	public static void markBrowserstackTestResult(AndroidDriver<AndroidElement> driver, boolean passed, String message) {
	    JavascriptExecutor jse = driver;
	    // Setting the status of test as 'passed' or 'failed' based on the condition
	    if (passed) {
	        jse.executeScript("browserstack_executor: {\"action\": \"setSessionStatus\", \"arguments\": {\"status\": \"passed\", \"reason\": \"" + message + "\"}}");
	    } else {
	        jse.executeScript("browserstack_executor: {\"action\": \"setSessionStatus\", \"arguments\": {\"status\":\"failed\", \"reason\": \"" + message + "\"}}");
	    }
	}
}