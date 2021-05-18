package org.fedarch.faims3.android;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;

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
		AndroidElement element = null;
		try {
		    element = driver.findElement(condition);
	    } catch (NoSuchElementException e) {
	    	// Element not visible. Catch error, scroll down and try again
	    	// Ugly, I know.. but there are no other ways!
	    	TestUtils.scrollDown(driver);
	    	element = TestUtils.scrollDownUntilVisible(condition, driver);
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
}