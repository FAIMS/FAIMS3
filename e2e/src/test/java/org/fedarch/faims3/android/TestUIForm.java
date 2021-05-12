package org.fedarch.faims3.android;

import java.lang.reflect.InvocationTargetException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;

import org.junit.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.remote.DesiredCapabilities;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import io.appium.java_client.MobileBy;
import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.AndroidElement;

public class TestUIForm {


  @Test
  public void testEmailField() throws MalformedURLException, NoSuchMethodException, SecurityException, IllegalAccessException, IllegalArgumentException, InvocationTargetException {

    DesiredCapabilities caps = new DesiredCapabilities();

//    caps.setCapability("device", "Samsung Galaxy S8 Plus");
//    caps.setCapability("os_version", "7.0");
//    caps.setCapability("project", "My First Project");
//    caps.setCapability("build", "My First Build");
//    caps.setCapability("name", "Bstack-[Java] Sample Test");
//    caps.setCapability("app", "");
    caps.setCapability("platformName", "Android");
    caps.setCapability("platformVersion", "10.0");
    caps.setCapability("deviceName", "Android Emulator");
    caps.setCapability("automationName", "Appium");
    caps.setCapability("adbExecTimeout", "1200000");
    caps.setCapability("app", "C:\\github\\FAIMS3\\android\\app\\build\\outputs\\apk\\debug\\app-debug.apk");

    AndroidDriver<AndroidElement> driver = new AndroidDriver<AndroidElement>(new URL("http://127.0.0.1:4723/wd/hub"), caps);

    // Email field
    AndroidElement emailField = (AndroidElement) new WebDriverWait(driver, 60).until(
        ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@resource-id='email-field']")));
    emailField.sendKeys("jane.doe@csiro.au");

    // Colour field
    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
    strField.sendKeys("Pink");

    // Scroll down until you can see text area field, and then fill it
    AndroidElement textField = TestUtils.scrollDownUntilVisible(MobileBy.xpath("//*[@resource-id='multi-str-field']"), driver);
    textField.sendKeys("いろはにほへとちりぬるを Pchnąć w tę łódź jeża lub ośm skrzyń fig จงฝ่าฟันพัฒนาวิชาการ    côté de l'alcôve ovoïde größeren");

    // Number field
    AndroidElement intField = driver.findElement(By.xpath("//*[@resource-id='int-field']"));
    intField.sendKeys("16");

    // Currency field
    AndroidElement currencyField = driver.findElement(MobileBy.xpath("//*[@resource-id='select-field' and @text='Currency']"));
    currencyField.click();
    // wait for list of currencies to load
    List<WebElement> values = new WebDriverWait(driver, 10).until(
            ExpectedConditions.visibilityOfAllElementsLocatedBy(
            		MobileBy.xpath("//android.widget.ListView[@text='Currency']/android.view.View")));
    // choose the first value: '$'
    values.get(0).click();

    // Multiple currency field
    AndroidElement multiCurrField = (AndroidElement) new WebDriverWait(driver, 10).until(
            ExpectedConditions.elementToBeClickable(
            		MobileBy.xpath("//*[@resource-id='multi-select-field' and @text='Currencies']")));
    multiCurrField.click();
    values = new WebDriverWait(driver, 10).until(
            ExpectedConditions.visibilityOfAllElementsLocatedBy(
            		MobileBy.xpath("//android.widget.ListView[@text='Currencies']/android.view.View")));
    // choose first, second, and fourth: $, euro and Yen
    values.get(0).click();
    values.get(1).click();
    values.get(3).click();

    // click on integer field above to hide the currency selection (would be covering the checkbox below)
    intField.click();

    // tick the checkbox
    AndroidElement checkbox = TestUtils.scrollDownUntilVisible(MobileBy.xpath("//*[@resource-id='checkbox-field']"), driver);
    checkbox.click();

    // radio button
    AndroidElement radioField = driver.findElement(MobileBy.xpath("//*[@resource-id='radio-group-field']"));
    // click the fourth one
    radioField.findElementsByClassName("android.view.View").get(3).findElementByClassName("android.widget.RadioButton").click();

    // Submit button
    AndroidElement submit = driver.findElement(By.xpath("//*[@text='SUBMIT']"));
    submit.click();

    //TODO: Validate JSON

    // The driver.quit statement is required, otherwise the test continues to execute, leading to a timeout.
    driver.quit();
  }
}