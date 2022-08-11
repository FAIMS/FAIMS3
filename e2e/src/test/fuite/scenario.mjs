/**
 * OPTIONAL: Setup code to run before each test
 * @param { import("puppeteer").Page } page
*/
export async function setup(page) {
  // Code to run once on the page to determine which tests to run
  console.log('in setup');
   
  // click on Sign-in
  console.log("Now going to Sign-in");
  const signin = await page.waitForXPath("//a[contains(@href,'/signin')]");
  await signin.click();  
  await page.waitForTimeout(10000);
 
  // click on Workspace
  console.log("Now going to Workspace..");
  const home = await page.waitForXPath("//button[contains(text(), 'Go Back To Workspace')]");
  await home.click();  
  await page.waitForTimeout(5000);
 
  // click on FIP project 
  console.log("Now going to FIP project..");
  const fip = await page.waitForXPath("//*[contains(text(), 'Farmers')]");
  await fip.click();  
  await page.waitForTimeout(5000);
}

/**
 * OPTIONAL: Code to run once on the page to determine which tests to run
 * @param { import("puppeteer").Page } page
 */
export async function createTests(page) {
   // This is required because it can't handle empty returns
  return Promise.resolve([
    {
      description: 'Test creating records',
      data: {
        foo: 1
      }
    }
  ])
}

/**
 * REQUIRED: Run a single iteration against a page – e.g., click a link and then go back
 * @param { import("puppeteer").Page } page
 * @param { any } data
 */
export async function iteration(page, data) {
    // Open up a new record
    const newRecord = await page.waitForXPath("//a[contains(@href,'/new/FORM1')]");
    console.log('Creating new record...');
    await newRecord.click();        
    await page.waitForTimeout(5000);

    // Enter mandatory fields
    console.log('Filling in job id..');
    const jobId = await generateJobID();
    await page.focus('#adminTextJobID');
    await page.keyboard.type(jobId);
    
    console.log('Filling in site id...');
    await page.focus('#adminTextDAFFSite');
    await page.keyboard.type("FuiteSite");

    console.log('Filling in contact name...');
    await page.focus('#adminTextOfficerName');
    await page.keyboard.type("FuiteAutomatedTest");

    // Save
    const saveButton = await page.waitForXPath("//button[contains(text(), 'Save and Close')]");           
    await saveButton.click();
    console.log('Saving record...');
    console.log('Should return to project...'); 
    await page.waitForTimeout(5000);
}

/**
 * Function to generate job id.
 */
export async function generateJobID() {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < 5; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
   }
   const id = result.toString();
   console.log("Job id is " + id);
   return id;
}

/**
 * OPTIONAL: Teardown code to run after each test
 * @param { import("puppeteer").Page } page
 */
export async function teardown(page) {
}

/**
 * OPTIONAL: Code to wait asynchronously for the page to become idle
 * @param { import("puppeteer").Page } page
 */
export async function waitForIdle(page) {
}