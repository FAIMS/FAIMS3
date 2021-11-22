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
 * Filename: IOSTest.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.ios;

import java.net.MalformedURLException;
import java.net.URL;

import org.fedarch.faims3.E2ETestSetup;
import org.fedarch.faims3.TestUtils;
import org.openqa.selenium.remote.DesiredCapabilities;

import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.ios.IOSElement;
import io.appium.java_client.remote.IOSMobileCapabilityType;

public class IOSTestSetup extends E2ETestSetup {

	/**
	 * Setup the IOSDriver based on parameter.
	 * @param localTest If true, then we'll set up a local connection. Otherwise we'll set up a browserstack one.
	 * @param testDesc Test description for browserstack
	 * @return
	 * @throws MalformedURLException
	 */
	public IOSDriver setup(boolean localTest, String testDesc) throws MalformedURLException {
	    DesiredCapabilities caps = new DesiredCapabilities();
	    // allow location services
	    caps.setCapability(IOSMobileCapabilityType.LOCATION_SERVICES_ENABLED, "true");
	    caps.setCapability(IOSMobileCapabilityType.LOCATION_SERVICES_AUTHORIZED, "true");
	    // accept location pop ups
	    caps.setCapability(IOSMobileCapabilityType.AUTO_ACCEPT_ALERTS, "true");
	    caps.setCapability("automationName", "XCUITest");
	    caps.setCapability("platformName", "iOS");
	    caps.setCapability("platformVersion", "13.7");
	    caps.setCapability("deviceName", "iPhone 11");
	    caps.setCapability("adbExecTimeout", "1200000");            
	    caps.setCapability("bundleId", "org.fedarch.faims3");
	    if (localTest) {
	        localConnectionSetup(caps);
	        isLocal = true;
	    } else {
		browserstackSetup(caps, testDesc);
	        isLocal = false;
	    }
	    // this is required because the autoAcceptAlerts doesn't actually work..
	    // see https://github.com/appium/appium/issues/14741
	    ((IOSDriver) driver).setSetting("acceptAlertButtonSelector",
		"**/XCUIElementTypeButton[`label == 'Allow While Using App'`]");
	    return (IOSDriver) driver;

	}

	/**
	 * Localhost setup for Rini's machine.
	 * @throws MalformedURLException
	 */
	public void localConnectionSetup(DesiredCapabilities caps) throws MalformedURLException {
	    caps.setCapability("app", "/Users/riniangreani/Documents/Payload/App.app");
	    driver = new IOSDriver<IOSElement>(new URL("http://127.0.0.1:4723/wd/hub"), caps);
	}

	/**
	 * Browserstack setup for the test
	 * @param testDescription Test scenario. Link to JIRA if possible.
	 * @throws MalformedURLException
	 */
	public void browserstackSetup(DesiredCapabilities caps, String testDescription) throws MalformedURLException {
	    caps.setCapability("project", "FAIMS3 - iOS Tests");
	    caps.setCapability("build", "Alpha");
	    String desc = testDescription.concat(" : ").concat(TestUtils.getCommitMessage());
	    caps.setCapability("name",
	    		// only 255 characters allowed
	    		desc.substring(0, Math.min(desc.length(), 255))
	    );
	    // Latest Appium browserstack version with correct geolocation
	    caps.setCapability("browserstack.appium_version", "1.21.0");

	    turnOnBrowserstackLogs(caps);

	    caps.setCapability("app", System.getenv("custom_id"));
	    caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
	    caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));

	    driver = new IOSDriver<IOSElement>(
                new URL("http://hub-cloud.browserstack.com/wd/hub"), caps);

	}

}
