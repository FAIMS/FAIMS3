//TODO investigate tablet scrolling , and scrollIntoView() on mobile
const deviceName = process.env.DEVICE_NAME
export const scrollDownMobileTabletCase = async()=>{
    await driver.touchAction([ //Scroll down(for xPath)
    { action: 'longPress', x: 1000, y: 1100 },
    { action: 'moveTo', x: 1000, y: 700 },
    'release'
])
}
export const scrollDown = async()=>{
    const windowSize = await driver.getWindowSize();
    const width = windowSize.width;
    const height = windowSize.height;

    const startX = width / 2;
    const startY = height * 0.8;
    const endY = height * 0.09;

    await driver.touchAction([ //Scroll down(for xPath)
        { action: 'longPress', x: startX, y: startY },
        { action: 'moveTo', x: 0, y: endY },
        'release'
    ])
}

export const tapByCoordinates = async() =>{
    await driver.touchAction({
        action:"tap",
        x: 60,
        y: 1850,
    })
}

export const tapByCoordinatesXY = async(x,y) =>{
    await driver.touchAction({
        action:"tap",
        x: x,
        y: y,
    })
}

export const tapByCoordinatesIOS = async() =>{
    await driver.touchAction({
        action:"tap",
        x: 400,
        y: 960,
    })
    if (deviceName.includes("iPhone")){
        await driver.touchAction({
            action:"tap",
            x: 190,
            y: 620,
        })
    }
}

export const scrollUp = async()=>{
    const windowSize = await driver.getWindowSize();
    const width = windowSize.width;
    const height = windowSize.height;

    const startX = width / 2;
    const startY = height * 0.2;
    const endY = height - 100;
    //const endY = height * 0.09;

    await driver.touchAction([ //Scroll up(for xPath)
        { action: 'longPress', x: startX, y: startY },
        { action: 'moveTo', x: 0, y: endY },
        'release'
    ])
}