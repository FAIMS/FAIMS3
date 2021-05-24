<h2>How to run e2e tests:</h2>
  
<h3>Pre-requisites:</h3>

* Install maven
* Install java (I use OpenJDK 13)

<h3>Steps:</h3>
<h4>Test with local Android web driver</h4>
1. By default, the tests are set to run with Browserstack. You can switch this by changing the localTest parameter in AndroidTest.setup() to true.
<br> e.g. in TestStagingForm.java:

  <blockquote>public static void setup() throws MalformedURLException {
	  <br>    // Change to true for local test connection
	  <br>    AndroidTest.setup(true, "Test Form Staging - Android");
  <br>}</blockquote>

2. Run the app from android studio:
<blockquote><br> npx cap open android</blockquote>
<br>From android studio, build and run the app with appropriate device.
<br><br>

3. Make sure appium has been installed.
<blockquote>npm install -g appium 
<br>install wd</blockquote>
Run appium in command line: 
<blockquote>appium &</blockquote>

4. Check that your local connection setup is correct in <a href="https://github.com/FAIMS/FAIMS3/blob/main/e2e/src/test/java/org/fedarch/faims3/android/AndroidTest.java">localConnectionSetup()</a>. 
5. Run the tests either as JUnit tests via your IDE (I use Eclipse), or via command line:
* Make sure you're on the same directory as this e2e folder. 
* Run: <blockquote>mvn install</blockquote>

6. To debug Android elements, I use UIAutomator.bat.

<h4>Test with Browserstack</h4>

1. Upload the app and make sure it's reflected in the <a href="https://github.com/FAIMS/FAIMS3/blob/main/e2e/src/test/java/org/fedarch/faims3/android/AndroidTest.java">android setup file</a>. <br>This can be done via BrowserStack's file manager or REST API:
<blockquote>curl -u "<username>:<password>" -X POST "https://api-cloud.browserstack.com/app-automate/upload" -F "file=@/path/to/app/file/Application-debug.apk"</blockquote>
In browserstackSetup(), update the "app" with the app URL: 
e.g. <blockquote>caps.setCapability("app", 'bs://87f241809661b3baa5fe15f6ad97322fd28b0a0e');</blockquote>

2. Set access credentials in browserstackSetup:
* caps.setCapability("browserstack.user", System.getenv("BROWSERSTACK_USERNAME"));
* caps.setCapability("browserstack.key", System.getenv("BROWSERSTACK_ACCESS_KEY"));

3. Run the tests either as JUnit tests via your IDE (I use Eclipse), or via command line:
* Make sure you're on the same directory as e2e this folder. 
* Run: mvn install
  
