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

import java.net.MalformedURLException;
import java.net.URL;

import org.fedarch.faims3.E2ETestSetup;
import org.fedarch.faims3.TestUtils;
import org.openqa.selenium.remote.DesiredCapabilities;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.remote.AndroidMobileCapabilityType;

public class AndroidTestSetup extends E2ETestSetup {

	/**
	 * Setup the AndroidDriver based on parameter.
	 * @param localTest If true, then we'll set up a local connection. Otherwise we'll set up a browserstack one.
	 * @param testDesc Test description for browserstack
	 * @return
	 * @throws MalformedURLException
	 */
	public AndroidDriver setup(boolean localTest, String testDesc) throws MalformedURLException {
		DesiredCapabilities caps = new DesiredCapabilities();
		// allow location services
	    caps.setCapability(AndroidMobileCapabilityType.GPS_ENABLED, "true");
	    caps.setCapability(AndroidMobileCapabilityType.SUPPORTS_LOCATION_CONTEXT, "true");
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
		// this is so it works with @AndroidFindBy
		((AppiumDriver) driver).context("NATIVE_APP");

		return (AndroidDriver) driver;
	}

	/**
	 * Localhost setup for Rini's machine.
	 * @throws MalformedURLException
	 */
	public void localConnectionSetup(DesiredCapabilities caps) throws MalformedURLException {
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
	public void browserstackSetup(DesiredCapabilities caps, String testDescription) throws MalformedURLException {
	    caps.setCapability("project", "FAIMS3 - Android Tests");
	    caps.setCapability("build", "Beta");
	    String desc = testDescription.concat(" : ").concat(TestUtils.getCommitMessage());
	    caps.setCapability("name",
	    		// only 255 characters allowed
	    		desc.substring(0, Math.min(desc.length(), 255))
	    );

	    // Specify device and os_version for testing
	    caps.setCapability("device", "Google Pixel 4");
	    caps.setCapability("os_version", "10.0");
	    // Latest Appium browserstack version with correct geolocation
	    caps.setCapability("browserstack.appium_version", "1.21.0");

	    turnOnBrowserstackLogs(caps);

	    caps.setCapability("app", System.getenv("app_url"));
	    caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
	    caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));

	    driver = new AndroidDriver<AndroidElement>(
	            new URL("http://hub.browserstack.com/wd/hub"), caps);

	}

}