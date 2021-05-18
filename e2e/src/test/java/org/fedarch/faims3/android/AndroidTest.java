package org.fedarch.faims3.android;

import java.net.MalformedURLException;
import java.net.URL;

import org.openqa.selenium.remote.DesiredCapabilities;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;

public class AndroidTest {
	protected static AndroidDriver<AndroidElement> driver;

	/**
	 * Setup the AndroidDriver based on parameter.
	 * @param localTest If true, then we'll set up a local connection. Otherwise we'll set up a browserstack one.
	 * @return an AndroidDriver instance
	 * @throws MalformedURLException
	 */
	public static void setup(boolean localTest) throws MalformedURLException {
		if (localTest) {
			localConnectionSetup();
		} else {
		    browserstackSetup();
		}
	}

	private static void localConnectionSetup() throws MalformedURLException {
		DesiredCapabilities caps = new DesiredCapabilities();
	    caps.setCapability("platformName", "Android");
	    caps.setCapability("platformVersion", "10.0");
	    caps.setCapability("deviceName", "Android Emulator");
	    caps.setCapability("automationName", "Appium");
	    caps.setCapability("adbExecTimeout", "1200000");
	    caps.setCapability("app", "C:\\github\\FAIMS3\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk");

	    driver = new AndroidDriver<AndroidElement>(new URL("http://127.0.0.1:4723/wd/hub"), caps);
	}

	private static void browserstackSetup() throws MalformedURLException {
		DesiredCapabilities caps = new DesiredCapabilities();

	    caps.setCapability("project", "My First Project");
	    caps.setCapability("build", "My First Build");
	    caps.setCapability("name", "Bstack-[Java] Sample Test");
	    caps.setCapability("automationName", "Appium");

	    // Specify device and os_version for testing
	    caps.setCapability("device", "Google Pixel 3");
	    caps.setCapability("os_version", "9.0");


        // TODO: will this work against Brian's Github script?
	    caps.setCapability("app", System.getenv("BROWSERSTACK_LOCAL_IDENTIFIER"));
	    caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
	    caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));

	    driver = new AndroidDriver<AndroidElement>(
	            new URL("http://hub.browserstack.com/wd/hub"), caps);

	}
}
