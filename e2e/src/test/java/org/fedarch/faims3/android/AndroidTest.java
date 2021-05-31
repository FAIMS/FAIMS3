package org.fedarch.faims3.android;

import java.net.MalformedURLException;
import java.net.URL;

import org.openqa.selenium.remote.DesiredCapabilities;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.remote.AndroidMobileCapabilityType;

public class AndroidTest {
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
	private static void localConnectionSetup(DesiredCapabilities caps) throws MalformedURLException {
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
	private static void browserstackSetup(DesiredCapabilities caps, String testDescription) throws MalformedURLException {
	    caps.setCapability("project", "FAIMS3 - Android Tests");
	    caps.setCapability("build", "Alpha");
	    caps.setCapability("name", testDescription);

	    // Specify device and os_version for testing
	    caps.setCapability("device", "Google Pixel 3");
	    caps.setCapability("os_version", "10.0");
	    // Latest Appium browserstack version with correct geolocation
	    caps.setCapability("browserstack.appium_version", "1.21.0");

        // TODO: will this work against Brian's Github script?
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
	public static boolean isUsingBrowserstack() {
		return !isLocal;
	}
}
