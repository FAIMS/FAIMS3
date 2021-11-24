package org.fedarch.faims3;

import java.net.MalformedURLException;

//import org.fedarch.faims3.android.AndroidTestSetup;
import org.fedarch.faims3.chrome.ChromeTestSetup;
import org.fedarch.faims3.ios.IOSTestSetup;
import org.json.JSONException;
import org.openqa.selenium.WebDriver;

public class WebDriverFactory {

		/**
	 * Factory method to create a web driver
	 * @param driverType String to represent the driver type, i.e. android, ios, chrome.
	 * @param localTest True if this is a local run for developers. The default is
	 *        false to use browserstack.
	 * @param testDesc Description of the test
	 * @return
	 * @throws JSONException
	 * @throws MalformedURLException
	 */
	public static WebDriver createDriver(String driverType,
			boolean localTest, String testDesc) throws MalformedURLException, JSONException {

		WebDriver driver = null;

		switch(driverType.toLowerCase()) {
		case "android":
			//driver = new AndroidTestSetup().setup(localTest, testDesc);
			break;
		case "ios":
			driver = new IOSTestSetup().setup(localTest, testDesc);
			break;
		case "chrome":
			driver = new ChromeTestSetup().setup(localTest, testDesc);
			break;
		default:
			throw new UnsupportedOperationException("Driver parameter: '"
					+ driverType + "' is not supported!");

		}
		return driver;
	}


}
