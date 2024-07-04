require('dotenv').config()

exports.config = {
    /*Put your user and key from browserstack*/
    user: process.env.BROWSERSTACK_USERNAME || '',
    key: process.env.BROWSERSTACK_ACCESS_KEY || '',
    hostname: 'hub.browserstack.com',
   updateJob: false,
    specs: [
        './specs/**.ts',
    ],
    exclude: [],
    services: [
        [
            'browserstack',
            {
                app: process.env.ANDROID_APP_BS,
                buildIdentifier: "${BUILD_NUMBER}",
                browserstackLocal: true,
                interactiveDebugging: true,
                setWebContentsDebuggingEnabled:true,
                autoWebView:true,
            },
        ]
    ],
    capabilities: [{
        'bstack:options': {
            projectName: "FAIMS3",
            buildName: 'FAIMS3 Android',
            deviceName: 'Google Pixel 4',
            platformVersion: '11.0',
            platformName: 'android',
            interactiveDebugging: true,
    }},{
        'bstack:options': {
            projectName: "FAIMS3",
            buildName: 'FAIMS3 Android',
            deviceName: 'Samsung Galaxy Tab S7',
            platformVersion: '11.0',
            platformName: 'android',
            interactiveDebugging: true,
        }},
        {
            'bstack:options': {
                projectName: "FAIMS3",
                buildName: 'FAIMS3 Android',
                deviceName: 'Samsung Galaxy Tab S8',
                platformVersion: '12.0',
                platformName: 'android',
                interactiveDebugging: true
            }},
    ],


    logLevel: 'info',
    coloredLogs: true,
    screenshotPath: './errorShots/',
    baseUrl: '',
    waitforTimeout: 10000,
    connectionRetryTimeout: 90000,
    connectionRetryCount: 3,
    maxInstances: 1,

    framework: 'mocha',
    mochaOpts: {
        ui: 'bdd',
        timeout: 120000
    }
};