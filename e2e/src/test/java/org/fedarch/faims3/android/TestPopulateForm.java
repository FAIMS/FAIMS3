package org.fedarch.faims3.android;

import java.lang.reflect.InvocationTargetException;
import java.net.MalformedURLException;
import java.util.List;

import org.junit.AfterClass;
import org.junit.BeforeClass;
import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidElement;

/**
 * Test populate the fields on the Android app:
 * https://faimsproject.atlassian.net/browse/FAIMS3-153
 *
 * @author Rini Angreani, CSIRO
 *
 */
public class TestPopulateForm extends AndroidTest {

  @BeforeClass
  public static void setup() throws MalformedURLException {
	  // Test with browserstack by default
	  // Change to true for local test connection
	  AndroidTest.setup(false);
  }

  /**
   * This test scenario is when you put in all the mandatory fields correctly and then click submit successfully.
   * @throws MalformedURLException
   * @throws NoSuchMethodException
   * @throws SecurityException
   * @throws IllegalAccessException
   * @throws IllegalArgumentException
   * @throws InvocationTargetException
   */
  @Test
  public void testNoErrors() throws MalformedURLException, NoSuchMethodException, SecurityException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {

    // Email field
    AndroidElement emailField = (AndroidElement) new WebDriverWait(driver, 60).until(
        ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@resource-id='email-field']")));
    String email = "jane.doe@csiro.au";
    emailField.sendKeys(email);

    // Colour field
    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
    String colour = "Pink";
    strField.sendKeys(colour);

    // Scroll down until you can see text area field, and then fill it with unicode text
    String unicodeText = "いろはにほへとちりぬるを Pchnąć w tę łódź jeża lub ośm skrzyń fig จงฝ่าฟันพัฒนาวิชาการ    côté de l'alcôve ovoïde größeren";
    AndroidElement textField = TestUtils.scrollDownUntilVisible(MobileBy.xpath("//*[@resource-id='multi-str-field']"), driver);
    textField.sendKeys(unicodeText);

    // Number field
    AndroidElement intField = driver.findElement(By.xpath("//*[@resource-id='int-field']"));
    String integer = "16";
    intField.sendKeys(integer);

    TestUtils.scrollDown(driver);

    // Currency field
    AndroidElement currencyField = driver.findElement(MobileBy.xpath("//*[@resource-id='select-field']"));
    currencyField.click();
    // wait for list of currencies to load
    AndroidElement currencyList = (AndroidElement) new WebDriverWait(driver, 10).until(
    		ExpectedConditions.presenceOfElementLocated(MobileBy.className("android.widget.ListView")));
    // choose the second value: Euro
    currencyList.findElements(MobileBy.className("android.view.View")).get(1).click();

    // Multiple currency field
    AndroidElement multiCurrField = (AndroidElement) new WebDriverWait(driver, 10).until(
            ExpectedConditions.elementToBeClickable(
            		MobileBy.xpath("//*[@resource-id='multi-select-field']")));
    multiCurrField.click();
    // choose first, second, and fourth: $, euro and Yen
    List<WebElement> currencies = new WebDriverWait(driver, 10).until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
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
    List<WebElement> radioButtons = new WebDriverWait(driver, 10).until(ExpectedConditions.visibilityOfNestedElementsLocatedBy(
    		MobileBy.xpath("//*[@resource-id='radio-group-field']"),
    		MobileBy.xpath("//android.widget.RadioButton")));
    // click the fourth one
    radioButtons.get(3).click();

    // Submit button
    AndroidElement submit = driver.findElement(By.xpath("//*[@text='SUBMIT']"));
    submit.click();

    // Validate json with expected values
    AndroidElement json = (AndroidElement) driver.findElements(MobileBy.xpath("//*[@resource-id='root']//android.view.View")).get(15)
    		.findElement(MobileBy.className("android.view.View"));
    json.getText().contentEquals(
    		"{\r\n" +
    		"  \"values\": {\r\n" +
    		"    \"take-point-field\": null,\r\n" +
    		"    \"bad-field\": \"\",\r\n" +
    		"    \"action-field\": \"hello\",\r\n" +
    		"    \"email-field\": " + email + ",\r\n" +
    		"    \"str-field\": " + colour + ",\r\n" +
    		"    \"multi-str-field\": "+ unicodeText + "\",\r\n" +
    		"    \"int-field\": " + integer + ",\r\n" +
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
    		"    \"email-field\": " + email + ",\r\n" +
    		"    \"str-field\": " + colour + ",\r\n" +
    		"    \"multi-str-field\": "+ unicodeText + "\",\r\n" +
    		"    \"int-field\": " + integer + ",\r\n" +
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
    		"}");
  }

  //TODO: test staging
  //TODO: test module selection

  @AfterClass
  public static void tearDown() {
	 // The driver.quit statement is required, otherwise the test continues to execute, leading to a timeout.
	 driver.quit();
  }
}