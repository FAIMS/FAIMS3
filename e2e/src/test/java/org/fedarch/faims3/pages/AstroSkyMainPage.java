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
 * Filename: AstroSky.java
 * Description:
 *   TODO
 */

package org.fedarch.faims3.pages;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertNotNull;
import static org.testng.Assert.assertTrue;

import java.util.List;

import org.fedarch.faims3.TestUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.RemoteWebDriver;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;
import io.appium.java_client.android.nativekey.AndroidKey;
import io.appium.java_client.android.nativekey.KeyEvent;
import io.appium.java_client.ios.IOSDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;
import io.appium.java_client.pagefactory.iOSXCUITFindBy;

/**
 * Page object for Astrosky::main observation form
 * @author Rini Angreani, CSIRO
 */
public class AstroSkyMainPage {
    public static final String EMAIL_ANDROID = "android-browserstack@faims.edu.au";

    public static final String EMAIL_CHROME = "chrome-browserstack@faims.edu.au";

    public static final String EMAIL_IOS = "ios-browserstack@faims.edu.au";

    public static final String EMAIL_DRAFT_ANDROID = "draft-observation-android-browserstack@faims.edu.au";

    public static final String EMAIL_DRAFT_CHROME = "draft-observation-chrome-browserstack@faims.edu.au";

	public static final String EMAIL_DRAFT_IOS = "draft-observation-ios-browserstack@faims.edu.au";

    public static final String COLOUR = "Pink";

    public static final String UNICODE = "いろはにほへとちりぬるを Pchnąć w tę łódź jeża lub ośm skrzyń fig จงฝ่าฟันพัฒนาวิชาการ    côté de l'alcôve ovoïde größeren";

    public static final String INTEGER = "16";

	@AndroidFindBy(xpath = "//*[@resource-id='take-point-field']")
	@FindBy(xpath = "//button/span[text()='Take Point']")
	@iOSXCUITFindBy(accessibility = "TAKE POINT")
	private WebElement gpsPoint;

	@AndroidFindBy(xpath = "//*[@text='Lat: ']")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeStaticText[@name=\"Lat:\"]/following-sibling::XCUIElementTypeStaticText")
	private WebElement lat;

	@iOSXCUITFindBy(xpath = "//XCUIElementTypeStaticText[@name=\"; Long:\"]/following-sibling::XCUIElementTypeStaticText")
	private WebElement longitude;

	@AndroidFindBy(xpath = "//*[@resource-id='action-field']")
	@FindBy(xpath = "//*[text()='Action!']")
	@iOSXCUITFindBy(accessibility = "ACTION!")
	private WebElement action;

	@AndroidFindBy(xpath = "//*[@resource-id='email-field']")
	@FindBy(id = "email-field")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[@name=\"Email Address\"]/following-sibling::XCUIElementTypeTextField")
	protected WebElement emailField;

	@AndroidFindBy(xpath = "//*[@resource-id='str-field']")
	@FindBy(id = "str-field")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[@name=\"Favourite Colour\"]/following-sibling::XCUIElementTypeTextField")
	protected WebElement colourField;

	@AndroidFindBy(xpath = "//*[@resource-id='multi-str-field']")
	@FindBy(id = "multi-str-field")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[@name=\"Textarea Field Label\"]/following-sibling::XCUIElementTypeTextView")
	private WebElement textField;

	@AndroidFindBy(xpath = "//*[@resource-id='int-field']")
	@FindBy(id = "int-field")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[@name= \"Integer Field Label\"]/following-sibling::XCUIElementTypeTextField")
	private WebElement intField;

	@AndroidFindBy(xpath = "//*[@resource-id='multi-select-field']")
	@FindBy(id = "multi-select-field")
	@iOSXCUITFindBy(iOSClassChain = "**/XCUIElementTypeOther[`label == \"Currencies ​\"`]")
	private WebElement multiCurrField;

	@AndroidFindBy(xpath = "//android.view.View/android.widget.ListView/android.view.View")
	@FindBy(xpath = "//*[@id='menu-multi-select-field']/div[3]/ul/li")
	@iOSXCUITFindBy(xpath = "//XCUIElementTypeOther[@name=\"Currency\"]/XCUIElementTypeOther[3]")
	private List<WebElement> currencies;

	@AndroidFindBy(xpath = "//*[@resource-id='checkbox-field']")
	@FindBy(id = "checkbox-field")
	@iOSXCUITFindBy(iOSClassChain = "**/XCUIElementTypeSwitch[`value == \"0\"`]")
	private WebElement checkBox;

	@AndroidFindBy(xpath = "//*[@resource-id='radio-group-field-4']")
	@FindBy(id = "radio-group-field-4")
	@iOSXCUITFindBy(accessibility = "4")
	private WebElement radioField;

	@AndroidFindBy(xpath = "//*[@resource-id='next-view']")
	@FindBy(xpath = "//*[text()='next-view']")
	@iOSXCUITFindBy(xpath = "//*[@name='next-view']")
	private WebElement nextView;

	@AndroidFindBy(xpath = "//*[@resource-id='select-field']")
	@FindBy(id = "select-field")
	@iOSXCUITFindBy(iOSClassChain = "**/XCUIElementTypeOther[`label == \"Currency ​\"`]")
	private WebElement currField;

	@AndroidFindBy(xpath = "//*[@text='Current URL:']/following-sibling::android.view.View")
	@FindBy(xpath = "//pre[last()]")
	private WebElement currentURL;

	@AndroidFindBy(xpath = "//*[@text='DEVELOPER TOOL: FORM STATE']/following-sibling::android.view.View/android.view.View")
	@FindBy(xpath = "//*[@id=\"root\"]/div[3]/div[3]/div/form/div/div[3]/div[2]/pre")
	@iOSXCUITFindBy(iOSClassChain = "**/XCUIElementTypeOther[`label == \"EDIT, tab panel\"`]/XCUIElementTypeOther[15]/XCUIElementTypeStaticText")
	private WebElement JSON;

	@AndroidFindBy(xpath = "//android.widget.Button[@text='Show path']")
	private WebElement showPath;

	@AndroidFindBy(xpath = "//android.widget.TextView[contains(@text, 'Projects')]")
	private WebElement projectsPath;

	@AndroidFindBy(xpath = "//*[@text='DEVELOPER TOOL: OBSERVATION REVISIONS']/"
						+ "following-sibling::android.view.View/android.view.View")
	private WebElement revisions;

	protected WebDriver driver;

	private WebDriverWait wait;

	public AstroSkyMainPage(WebDriver driver) {
		this.driver = driver;
		this.wait = new WebDriverWait(driver, 10);
		PageFactory.initElements(new AppiumFieldDecorator(driver), this);
	}

	/**
	 * Fill out all fields in test AsTRoSkY form with valid values.
	 */
	public void fillOutFormWithValidFields() {
		//Press the Take Point Button.
		wait.until(ExpectedConditions.elementToBeClickable(
		        		this.gpsPoint)).click();

		//Observe your longitude and latitude output rendered beside the button, and in the developer side-panel as a JSON object
		wait.until(ExpectedConditions.visibilityOf(this.lat));
		validateLatLong();

		//Press the Action button, note that the JSON debug view now shows Change! rather than hello
		TestUtils.scrollToId(driver, "action-field").click();

		// Finish the observation
	    // Email field
		WebElement email = TestUtils.scrollToId(driver, "email-field");
		if (driver instanceof AndroidDriver) {
	        email.sendKeys(EMAIL_ANDROID);
		} else if (driver instanceof IOSDriver) {
			email.sendKeys(EMAIL_IOS);
		} else {
			email.sendKeys(EMAIL_CHROME);
		}

	    // Colour field
		TestUtils.scrollToId(driver, "str-field").sendKeys(COLOUR);

	    // Text area - test unicode
	    TestUtils.scrollToId(driver, "multi-str-field").sendKeys(UNICODE);

	    // Integer field
	    this.intField.click();
	    if (driver instanceof AndroidDriver) {
		    ((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DEL));
		    ((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DIGIT_1));
		    // Hide the number keyboard so we can see the rest of the screen
		    ((AndroidDriver) driver).hideKeyboard();
	    }

	    // Multiple currency field
	    this.multiCurrField.click();
	    // choose first, second: $, Euro
	    List<WebElement> currencies = wait.until(
	    		ExpectedConditions.visibilityOfAllElements(this.currencies));
	    currencies.get(0).click();
	    currencies.get(1).click();

	    // click out of the dropdown
	    if (driver instanceof AndroidDriver) {
	    	((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.ESCAPE));
	    }
	    // tick the checkbox
	    this.checkBox.click();

	    // radio button - click on he fourth one
	    TestUtils.scrollToId(driver, "radio-group-field-4");
	    this.radioField.click();

	    // scroll up to the very top, and click "next-view"
	    TestUtils.scrollToText(driver, "next-view").click();

	    // Integer field on page 2
	    this.intField.click();
	    if (driver instanceof AndroidDriver) {
	    	((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DEL));
	    	((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DIGIT_1));
	    	((AndroidDriver) driver).pressKey(new KeyEvent(AndroidKey.DIGIT_6));
		    // Hide the number keyboard so we can see the rest of the screen
	    	((AndroidDriver) driver).hideKeyboard();
	    }

	    // Currency field on page 2
	    this.currField.click();
	    // choose second: Euro
	    currencies = wait.until(
	    		ExpectedConditions.visibilityOfAllElements(this.currencies));
	    currencies.get(1).click();
	}

	/**
	 * Validate the lat long values generated by "Take Point" button.
	 */
	public void validateLatLong() {
		//in Android 10, the element class name is actually android.widget.TextView
		//but otherwise it's android.view.View
		//ideally there should be an id so it's nice and easy, but we work with what we've got
		// so we have to work out the class name and get the siblings
		if (driver instanceof AndroidDriver) {
			String className = lat.getAttribute("className");
			WebElement lat = driver.findElement(By.xpath("//*[@text='Lat: ']/../" + className + "[2]"));
			assertEquals(TestUtils.roundCoordinate(getLatitude()),
					TestUtils.roundCoordinate(lat.getText()));
			WebElement longi = driver.findElement(By.xpath("//*[@text='Lat: ']/../" + className + "[4]"));
			assertEquals(getLongitude(), longi.getText());
		} else if (driver instanceof IOSDriver) {
			String latVal = this.lat.getText();
			assertNotNull(latVal);
			assertTrue(!Double.isNaN(Double.parseDouble(latVal)));

			String longVal = this.longitude.getText();
			assertNotNull(longVal);
			assertTrue(!Double.isNaN(Double.parseDouble(longVal)));
		} else {
			String text = driver.findElement(By.xpath(
					"//button/span[text()='Take Point']/../following-sibling::span")).getText();
			String latitude = getLatitude();
			String longitude = getLongitude();

			String expectedText = new StringBuffer("Lat: ").append(latitude)
					.append("; Long: ").append(longitude).toString();
			assertEquals(TestUtils.roundCoordinate(expectedText),
					TestUtils.roundCoordinate(text));

		}
	}

	public String getLatitude() {
		if (driver instanceof AndroidDriver) {
			return String.valueOf(((AndroidDriver) driver).location().getLatitude());
		} else if (driver instanceof IOSDriver) {
			return String.valueOf(((IOSDriver) driver).location().getLatitude());
		} else {
			Object lat = ((RemoteWebDriver)driver).executeScript(
					 "function getPosition() {\n" +
					 "    return new Promise((res, rej) => {\n" +
					 "    	navigator.geolocation.getCurrentPosition(res, rej)\n" +
					 "    });\n" +
					 "}\n" +
					 "\n" +
					 "async function getLat() {\n" +
					 "    var position = await getPosition();\n" +
					 "    return position.coords.latitude;\n" +
					 "}\n" +
					 "return getLat();");
			    assertNotNull(lat);
			    return lat.toString();
		}
	}

	public String getLongitude() {
		if (driver instanceof AndroidDriver) {
			return String.valueOf(((AndroidDriver) driver).location().getLongitude());
		} else if (driver instanceof IOSDriver) {
			return String.valueOf(((IOSDriver) driver).location().getLongitude());
		} else {
			Object longi = ((RemoteWebDriver)driver).executeScript(
					 "function getPosition() {\n" +
					 "    return new Promise((res, rej) => {\n" +
					 "    	navigator.geolocation.getCurrentPosition(res, rej)\n" +
					 "    });\n" +
					 "}\n" +
					 "\n" +
					 "async function getLong() {\n" +
					 "    var position = await getPosition();\n" +
					 "    return position.coords.longitude;\n" +
					 "}\n" +
					 "return getLong();");
			    assertNotNull(longi);
			    return longi.toString();
		}
	}

	public String getRecordId() {
		// Take note of the UUID for the rest of the tests
		TestUtils.scrollToText(driver, "Current URL:");
	    String[] urlPaths = this.currentURL.getAttribute("text").split("/");
	    return urlPaths[urlPaths.length - 1];
    }

	/**
	 * Validate JSON at the end of the form with input values.
	 * @return True if JSON is valid, false otherwise.
	 * @throws JSONException
	 */
	public void validateJSON() throws JSONException, AssertionError {
		// Find JSON
		TestUtils.scrollToText(driver, "DEVELOPER TOOL: FORM STATE");

		WebElement json = wait.until(ExpectedConditions.visibilityOf(
				this.JSON));
		JSONObject jsonObject = new JSONObject(json.getText());
		JSONObject values = jsonObject.getJSONObject("values");

		assertEquals("Change!", values.get("action-field").toString());
		if (driver instanceof AndroidDriver) {
			assertEquals(EMAIL_ANDROID, values.get("email-field").toString());
		} else if (driver instanceof IOSDriver) {
			assertEquals(EMAIL_IOS, values.get("email-field").toString());
		} else {
			assertEquals(EMAIL_CHROME, values.get("email-field").toString());
		}
        assertEquals(COLOUR, values.get("str-field").toString());
        assertEquals(UNICODE, values.get("multi-str-field").toString());
        assertEquals(INTEGER, values.get("int-field").toString());
        assertEquals("[\"USD\",\"EUR\"]", values.get("multi-select-field").toString());
        assertEquals("EUR", values.get("select-field").toString());
        // FIXME: seems like an appium bug. The values below aren't updating despite us waiting and reretrieving them
        // Our attempt as below:
		// wait for JSON to be updated by checking that touched has been updated for the last field
		//int tries = 0;
		//while (tries < 3 && !jsonObject.getJSONObject("touched").has("checkbox-field")) {
		//	try {
		//		Thread.sleep(5000);
		//	} catch (InterruptedException e) {
		//		// TODO Auto-generated catch block
		//		e.printStackTrace();
		//	}
		//	json = driver.findElement(MobileBy.xpath(
		//			"//*[@text='DEVELOPER TOOL: FORM STATE']/following-sibling::android.view.View/android.view.View"));
		//	jsonObject = new JSONObject(json.getText());
		//	tries++;
		//}
        //assertEquals("true", values.get("checkbox-field").toString());
        //assertEquals("4", values.get("radio-group-field").toString());
        // no errors
        //assertEquals("{}", jsonObject.get("errors").toString());

	}

	public void verifyMessage(String message) {
		if (driver instanceof AndroidDriver || driver instanceof IOSDriver) {
		    wait.until(ExpectedConditions.visibilityOfElementLocated(
				By.xpath("//*[@text='" + message + "']")));
		} else {
			wait.until(ExpectedConditions.presenceOfElementLocated(
					By.xpath("//div[@class='MuiAlert-message' and text()='" + message + "']")));
		}
	}

	public void leaveObservationForm() {
		TestUtils.scrollToText(driver, "Show path");
		if (this.showPath.isDisplayed()) {
			this.showPath.click();
		}
		wait.until(ExpectedConditions
				.elementToBeClickable(this.projectsPath)).click();
	}

	/**
	 * Get a list of revisions of a record being viewed from the "REVISIONS" tab.
	 * @return
	 */
	public String[] getRevisions() {
		wait.until(ExpectedConditions.presenceOfElementLocated(MobileBy.linkText("REVISIONS"))).click();

		AndroidElement revisions = (AndroidElement)wait.until(ExpectedConditions.presenceOfElementLocated(
				MobileBy.xpath("//*[@text='DEVELOPER TOOL: OBSERVATION REVISIONS']/"
						+ "following-sibling::android.view.View/android.view.View")));
		// remove square brackets and split by comma separator
		return revisions.getText().replaceAll("\\[", "").replaceAll("\\]","").split(",");

	}

	public void submit() {
		WebElement submit = TestUtils.scrollToText(driver, "SAVE AND NEW");
		submit.click();
	}

	public String getIntFieldValue() {
		return this.intField.getText();
	}

	public String getMultiCurrenciesValue() {
		return this.multiCurrField.getText();
	}

	public String isCheckBoxChecked() {
		return this.checkBox.getAttribute("checked");
	}

}
