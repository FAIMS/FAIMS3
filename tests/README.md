# Automated Testing for FAIMS Frontend

## Preconditions

* Fill User Fixture with your own Login and Password, choose isLocal(true,false) for 
local and browserstack run .env file (create in root project)

* Fill BrowserStack Credential Android [bs.conf.ts](test%2Ffirst.conf.ts)
* Fill BrowserStack Credential iOs [bsiOs.conf.ts](test%2FbsiOs.conf.ts)
* Run tests BrowserStack Android - `npm run testBrowserStack`
* Run tests BrowserStack iOs - `npm run testBsIos`
* Go to [BrowserStack](https://www.browserstack.com/) Dashboard

## Device list

### Android

Can be managed on [bs.conf.ts](test%2Fbs.conf.ts) just add  

```javascript
'bstack:options': {
    projectName: "FAIMS3",
    buildName: 'FAIMS3 Android',
    deviceName: 'Samsung Galaxy Tab S8',
    platformVersion: '12.0',
    platformName: 'android',
}
```

in the capabilities array.

### iOs

Can be managed on [.env](.env) just add 
```javascript
DEVICE_NAME="iPad Pro 11 2022" or DEVICE_NAME="iPhone 14"
```

in the capabilities array.

## Local Run

For local run you need to be sure appium was run, appium-doctor doesn't have any critical issues

### Install `appium-doctor`

```bash
npm install @appium/doctor --location=global
```

Running `appium-doctor` will check that your machine is set up properly for appium. 

### Run Appium

Appium - run `npm run appium`.

File for run was described in [wdio.conf.ts](wdio.conf.ts) `appium:app`

Open Android Studio and run emulator (Freeform not supported now, use
like Nexus 9 or another tablet or phone). iOs not implemented yet for local testing.

* Run tests local emulator - `npm run test`
* Be sure you have one screenshot or image on emulator
* Appium versions 2.0
* Node version 18

## To resolve issues with appium android_home, java_home

Add the following lines to `~/.bash_profile` or equivalent.

```bash
export ANDROID_HOME=/Users/xxx/Library/Android/sdk
export JAVA_HOME=$(/usr/libexec/java_home)
```

## Reporter

After Suite run was finished you can look on report - [Reporter](https://observability.browserstack.com/projects/FAIMS3/builds).

## Test suites

Create new notebook Suite - [newNoteBookTablet.ts](test%2Fspecs%2FnewNoteBookTablet.ts)

Sing in Tests Suite - [SignInTests.ts](test%2Fspecs%2FSignInTests.ts)

User Tests Suite - [UserTests.ts](test%2Fspecs%2FUserTests.ts)

WorkSpaceSuite - [WorkSpaceTests.ts](test%2Fspecs%2FWorkSpaceTests.ts)

## Locators 

Described by Pages [pages](pages).
