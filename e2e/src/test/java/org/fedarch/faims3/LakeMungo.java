package org.fedarch.faims3;

import static org.junit.Assert.assertEquals;

import java.util.List;

import org.fedarch.faims3.android.TestUtils;
import org.json.JSONException;
import org.json.JSONObject;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;

/**
 * Utilities and constants used in Lake Mungo test form
 * @author Rini Angreani, CSIRO
 */
public class LakeMungo {
    public static final String EMAIL = "jane.doe@csiro.au";
    public static final String COLOUR = "Pink";
    public static final String UNICODE = "いろはにほへとちりぬるを Pchnąć w tę łódź jeża lub ośm skrzyń fig จงฝ่าฟันพัฒนาวิชาการ    côté de l'alcôve ovoïde größeren";
    public static final String INTEGER = "16";

	/**
	 * Fill out all fields in test Lake Mungo form with valid values.
	 * @param driver AndroidDriver
	 */
	public static void fillOutFormWithValidFields(AndroidDriver<AndroidElement> driver) {
		WebDriverWait wait = new WebDriverWait(driver, 10);
	    // Email field
	    AndroidElement emailField = (AndroidElement) wait.until(
	        ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@resource-id='email-field']")));
	    emailField.sendKeys(LakeMungo.EMAIL);

	    // Colour field
	    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
	    strField.sendKeys(LakeMungo.COLOUR);

	    // Scroll down until you can see text area field, and then fill it with unicode text

	    AndroidElement textField = TestUtils.scrollDownUntilVisible(MobileBy.xpath("//*[@resource-id='multi-str-field']"), driver);
	    textField.sendKeys(LakeMungo.UNICODE);

	    // Number field
	    AndroidElement intField = driver.findElement(By.xpath("//*[@resource-id='int-field']"));
	    intField.sendKeys(LakeMungo.INTEGER);

	    TestUtils.scrollDown(driver);

	    // Currency field
	    AndroidElement currencyField = driver.findElement(MobileBy.xpath("//*[@resource-id='select-field']"));
	    currencyField.click();
	    // wait for list of currencies to load
	    AndroidElement currencyList = (AndroidElement) wait.until(
	    		ExpectedConditions.presenceOfElementLocated(MobileBy.className("android.widget.ListView")));
	    // choose the second value: Euro
	    currencyList.findElements(MobileBy.className("android.view.View")).get(1).click();

	    // Multiple currency field
	    AndroidElement multiCurrField = (AndroidElement) wait.until(
	            ExpectedConditions.elementToBeClickable(
	            		MobileBy.xpath("//*[@resource-id='multi-select-field']")));
	    multiCurrField.click();
	    // wait for the spinner overlay to disappear so we can see everything on the list
	    wait.until(ExpectedConditions.invisibilityOf(multiCurrField));
	    // choose first, second, and fourth: $, euro and Yen
	    List<WebElement> currencies = wait.until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
	    		MobileBy.xpath("//android.view.View/android.widget.ListView"),
	    		MobileBy.xpath("//android.view.View")));
	    currencies.get(0).click();
	    currencies.get(1).click();
	    currencies.get(3).click();

	    // click on integer field above to hide the currency selection (would be covering the checkbox below)
	    intField.click();

	    // tick the checkbox
	    AndroidElement checkbox = TestUtils.scrollDownUntilVisible(MobileBy.xpath("//*[@resource-id='checkbox-field']"), driver);
	    checkbox.click();

	    // radio button
	    List<WebElement> radioButtons = wait.until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
	    		MobileBy.xpath("//*[@resource-id='radio-group-field']"),
	    		MobileBy.xpath("//android.widget.RadioButton")));
	    // click the fourth one
	    radioButtons.get(3).click();
	}

	/**
	 * Validate JSON at the end of the form with input values.
	 * @param driver Android driver
	 * @return True if JSON is valid, false otherwise.
	 * @throws JSONException
	 */
	public static boolean validateJSON(AndroidDriver<AndroidElement> driver) throws JSONException, AssertionError {
		// Find JSON
		WebDriverWait wait = new WebDriverWait(driver, 10);
		// wait for Submit to finish
		wait.until(ExpectedConditions.presenceOfElementLocated(MobileBy.xpath("//*[@text='SUBMIT']")));
		AndroidElement json = (AndroidElement) wait.until(ExpectedConditions.visibilityOf(
				driver.findElement(MobileBy.xpath("//*[@text='SUBMIT']/following-sibling::android.view.View/android.view.View"))));
		JSONObject jsonObject = new JSONObject(json.getText());
		JSONObject values = jsonObject.getJSONObject("values");

		assertEquals(EMAIL, values.get("email-field").toString());
        assertEquals(COLOUR, values.get("str-field").toString());
        assertEquals(UNICODE, values.get("multi-str-field").toString());
        assertEquals(INTEGER, values.get("int-field").toString());
        assertEquals("EUR", values.get("select-field").toString());
        assertEquals("[\"USD\",\"EUR\",\"JPY\"]", values.get("multi-select-field").toString());
        assertEquals("true", values.get("checkbox-field").toString());
        assertEquals("4", values.get("radio-group-field").toString());
        // no errors
        assertEquals("{}", jsonObject.get("errors").toString());

	    return true;
	}
}
