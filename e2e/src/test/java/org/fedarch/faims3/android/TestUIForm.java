package org.fedarch.faims3.android;

import java.lang.reflect.InvocationTargetException;
import java.net.MalformedURLException;
import java.net.URL;
import java.util.List;

import org.junit.Test;
import org.openqa.selenium.By;
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

    // String field
    AndroidElement strField = driver.findElement(MobileBy.xpath("//*[@resource-id='str-field']"));
    strField.sendKeys("Some text");

    // Scroll down until you can see number field, and then fill it in
    AndroidElement intField = TestUtils.scrollDownUntilVisible(By.xpath("//*[@resource-id='int-field']"), driver);
    intField.sendKeys("16");

    // Currency field
    AndroidElement currencyField = driver.findElement(MobileBy.xpath("//*[@resource-id='select-field' and @text='Choose a currency']"));
    currencyField.click();
    //TODO: wait for it to load
    List<AndroidElement> values = driver.findElements(MobileBy.xpath("//android.widget.ListView[@text='Choose a currency']/android.view.View"));
    // choose the first value: '$'
    values.get(0).click();

    // Multiple currency field
    AndroidElement multiCurrField = (AndroidElement) new WebDriverWait(driver, 10).until(
            ExpectedConditions.elementToBeClickable(MobileBy.xpath("//*[@resource-id='multi-select-field' and @text='Choose multiple currencies']")));
    multiCurrField.click();
    values = driver.findElements(MobileBy.xpath("//android.widget.ListView[@text='Choose multiple currencies']/android.view.View"));
    // choose first, second, and fourth: $, euro and Yen
    values.get(0).click();
    values.get(1).click();
    values.get(3).click();

    // Submit button
    AndroidElement submit = driver.findElement(By.xpath("//*[@text='SUBMIT'"));
    submit.click();

    // Validate JSON

    // The driver.quit statement is required, otherwise the test continues to execute, leading to a timeout.
    driver.quit();
  }
}