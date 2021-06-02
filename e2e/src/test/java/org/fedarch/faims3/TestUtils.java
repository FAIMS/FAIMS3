package org.fedarch.faims3;

import org.openqa.selenium.By;
import org.openqa.selenium.JavascriptExecutor;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.html5.Location;
import org.openqa.selenium.remote.RemoteWebDriver;
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
		} else {
			// TODO: implement chrome and ios support if needed
			throw new UnsupportedOperationException("Chrome and IOS scroll() aren't supported yet!");
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
	 * Load up new Lake Mungo form.
	 *
	 * @param driver AndroidDriver
	 */
	public static void loadNewAstroSkyForm(AndroidDriver<AndroidElement> driver) {
		// Click on "Projects"
		WebElement projects = new WebDriverWait(driver, 10).until(
			        ExpectedConditions.elementToBeClickable(MobileBy.xpath ("//android.view.MenuItem[contains(@text, 'Projects')]")));
		projects.click();

		// Get the right project
		AndroidElement AstroSky = (AndroidElement) new WebDriverWait(driver, 10).until(
		        ExpectedConditions.presenceOfElementLocated(MobileBy.xpath(
		        		"//*[@text='Lake Mungo Archaeological Survey - 2018']")));
	    // Find the '+' button
		AndroidElement newButton = (AndroidElement) AstroSky.findElement(By.xpath(
	    		"../android.view.View[5]/android.widget.Button[contains(@text, 'NEW OBSERVATION')]"));
		newButton.click();
	}

	/**
	 * Load up new Lake Mungo form.
	 *
	 * @param driver ChromeDriver
	 */
	public static void loadNewAstroSkyForm(RemoteWebDriver driver) {
		// Click on "Projects"
		WebElement projects = new WebDriverWait(driver, 10).until(
			        ExpectedConditions.elementToBeClickable(By.xpath ("//a[@href='/projects']")));
		projects.click();
	    // Find the '+' button for Lake Mungo
		WebElement newObservation = new WebDriverWait(driver, 10).until(
		        ExpectedConditions.elementToBeClickable(By.xpath ("//a[@href='/projects/default_lake_mungo/new-observation']")));
	    newObservation.click();
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
	 * Get location of the driver
	 * @param driver WebDriver
	 * @return
	 */
	public static Location getLocation(WebDriver driver) {
		Location location = null;

		if (driver instanceof ChromeDriver) {
			location = ((ChromeDriver) driver).location();
		} else if (driver instanceof AndroidDriver) {
			location = ((ChromeDriver) driver).location();
		}
		//TODO: handle IOS

		return location;
	}

	/**
	 * Get a string representation of the driver's location latitude.
	 * @param driver
	 * @return Latitude string
	 */
	public static String getLatitude(WebDriver driver) {
		Location location = getLocation(driver);
		if (location != null) {
			return String.valueOf(location.getLatitude());
		}
		return "";
	}

	/**
	 * Get a string representation of the driver's location longitude.
	 * @param driver
	 * @return Longitude string
	 */
	public static String getLongitude(WebDriver driver) {
		Location location = getLocation(driver);
		if (location != null) {
			return String.valueOf(location.getLongitude());
		}
		return "";
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
}