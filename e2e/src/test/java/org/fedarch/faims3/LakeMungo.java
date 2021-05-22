package org.fedarch.faims3;

import java.util.List;

import org.fedarch.faims3.android.TestUtils;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.MobileElement;
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
    public static final String INTEGER = "16.0";

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
	 */
	public static boolean validateJSON(AndroidDriver<AndroidElement> driver) {
	    // Find JSON
		AndroidElement lakeMungoTab = driver.findElement(MobileBy.xpath("//*[@resource-id='scrollable-auto-tabpanel-default/lake_mungo']"));
		AndroidElement root = (AndroidElement) lakeMungoTab.findElements(MobileBy.xpath("//android.view.View")).get(2);
		List<MobileElement> children = root.findElements(MobileBy.xpath("//android.view.View"));
		AndroidElement json = (AndroidElement) children.get(children.size() - 1).findElement(MobileBy.className("android.view.View"));
	    String jsonText =
	    		"{\r\n" +
	    		"  \"values\": {\r\n" +
	    		"    \"take-point-field\": null,\r\n" +
	    		"    \"bad-field\": \"\",\r\n" +
	    		"    \"action-field\": \"hello\",\r\n" +
	    		"    \"email-field\": " + LakeMungo.EMAIL + ",\r\n" +
	    		"    \"str-field\": " + LakeMungo.COLOUR + ",\r\n" +
	    		"    \"multi-str-field\": "+ LakeMungo.UNICODE + "\",\r\n" +
	    		"    \"int-field\": " + LakeMungo.INTEGER + ",\r\n" +
	    		"    \"select-field\": \"EUR\",\r\n" +
	    		"    \"multi-select-field\": [\"USD\", \"EUR\", \"JPY\"],\r\n" +
	    		"    \"checkbox-field\": true,\r\n" +
	    		"    \"radio-group-field\": \"4\"\r\n" +
	    		"  },\r\n" +
	    		"  \"errors\": {},\r\n" +
	    		"  \"touched\": {\r\n" +
	    		"    \"take-point-field\": true,\r\n" +
	    		"    \"bad-field\": true,\r\n" +
	    		"    \"action-field\": true,\r\n" +
	    		"    \"email-field\": true,\r\n" +
	    		"    \"str-field\": true,\r\n" +
	    		"    \"multi-str-field\": true,\r\n" +
	    		"    \"int-field\": true,\r\n" +
	    		"    \"select-field\": true,\r\n" +
	    		"    \"multi-select-field\": [\r\n" +
	    		"      true,\r\n" +
	    		"      true,\r\n" +
	    		"      false,\r\n" +
	    		"      true\r\n" +
	    		"    ],\r\n" +
	    		"    \"checkbox-field\": true,\r\n" +
	    		"    \"radio-group-field\": true\r\n" +
	    		"  },\r\n" +
	    		"  \"isSubmitting\": false,\r\n" +
	    		"  \"isValidating\": false,\r\n" +
	    		"  \"submitCount\": 1,\r\n" +
	    		"  \"initialValues\": {\r\n" +
	    		"    \"take-point-field\": null,\r\n" +
	    		"    \"bad-field\": \"\",\r\n" +
	    		"    \"action-field\": \"hello\",\r\n" +
	    		"    \"email-field\": " + LakeMungo.EMAIL + ",\r\n" +
	    		"    \"str-field\": " + LakeMungo.COLOUR + ",\r\n" +
	    		"    \"multi-str-field\": "+ LakeMungo.UNICODE + "\",\r\n" +
	    		"    \"int-field\": " + LakeMungo.INTEGER + ",\r\n" +
	    		"    \"select-field\": \"EUR\",\r\n" +
	    		"    \"multi-select-field\": [\"USD\", \"EUR\", \"JPY\"],\r\n" +
	    		"    \"checkbox-field\": true,\r\n" +
	    		"    \"radio-group-field\": \"4\"\r\n" +
	    		"  },\r\n" +
	    		"  \"initialErrors\": {},\r\n" +
	    		"  \"initialTouched\": {},\r\n" +
	    		"  \"isValid\": true,\r\n" +
	    		"  \"dirty\": true,\r\n" +
	    		"  \"validateOnBlur\": true,\r\n" +
	    		"  \"validateOnChange\": true,\r\n" +
	    		"  \"validateOnMount\": true\r\n" +
	    		"}";
	    return json.getText().contentEquals(jsonText);
	}
}
