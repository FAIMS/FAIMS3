## How to run e2e tests:
  
### Pre-requisites:

* Install maven
* Install java (I use OpenJDK 13)

### Steps:


#### Test with local Android web driver

1. By default, the tests are set to run with Browserstack. You can switch this by changing the localTest parameter in AndroidTest.setup() to true.

e.g. in `TestStagingForm.java`:

```java
public static void setup() throws MalformedURLException {
    // Change to true for local test connection
    AndroidTest.setup(true, "Test Form Staging - Android");
}

```

2. Run the device emulator (Tools -> AVD Manager -> select and start device) from android studio.

To set up Android Studio the first time:
- Download Android Studio.
- Tools -> AVD Manager -> create new Virtual Device
- Tools -> SDK Manager -> make sure appropriate SDK has been downloaded.
- Setup ANDROID_HOME and ANDROID_SDK_ROOT in environment variables. You can find ANDROID location in SDK Manager. Restart
- Start device in AVD Manager


3. Make sure appium has been installed, before running it.
```bash
npm install -g appium
install wd
```
Run appium in command line: 

`appium &`

4. Check that your local connection setup is correct in <a href="https://github.com/FAIMS/FAIMS3/blob/main/e2e/src/test/java/org/fedarch/faims3/android/AndroidTest.java">localConnectionSetup()</a>. 

5. Run the tests either as JUnit tests via your IDE (I use Eclipse), or via command line:
* Make sure you're on the same directory as this e2e folder. 
* Run: `mvn install`

6. To debug Android elements, I use UIAutomatorViewer.bat. Browserstack app-live also has inspect functionality in the Dev Tools. 

#### Test with Browserstack

1. Upload the app and make sure it's reflected in the <a href="https://github.com/FAIMS/FAIMS3/blob/main/e2e/src/test/java/org/fedarch/faims3/android/AndroidTest.java">android setup file</a>. <br>This can be done via BrowserStack's file manager or REST API:
```
curl -u "<username>:<password>" -X POST "https://api-cloud.browserstack.com/app-automate/upload" -F "file=@/path/to/app/file/Application-debug.apk"
```


In browserstackSetup(), update the "app" with the app URL: 
e.g. `caps.setCapability("app", 'bs://87f241809661b3baa5fe15f6ad97322fd28b0a0e');`


2. Set access credentials in browserstackSetup:
```bash
caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));
```


3. Run the tests either as JUnit tests via your IDE (I use Eclipse), or via command line:
* Make sure you're on the same directory as e2e this folder. 
* Run: `mvn install`
  
