require('dotenv').config()

exports.config = {
    /*Put your user and key from browserstack*/
    user: process.env.BROWSERSTACK_USERNAME || '',
    key: process.env.BROWSERSTACK_ACCESS_KEY || '',
    hostname: 'hub.browserstack.com',
    updateJob: false,
    specs: [
        './specs/iOs/**.ts',
    ],
    exclude: [],
    services: [
        [
            'browserstack',
            {
                app: process.env.IOS_APP_BS,
                buildIdentifier: "${BUILD_NUMBER}",
                browserstackLocal: true
            },
        ]
    ],
    capabilities: [{
        'bstack:options': {
            projectName: "FAIMS3",
            deviceName: process.env.DEVICE_NAME,
            platformVersion: '16.4',
            platformName: 'ios',
        },
    }],


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