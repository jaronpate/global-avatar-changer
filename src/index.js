const { app, BrowserWindow, ipcMain, autoUpdater, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const Store = require('electron-store');
const { stringify } = require('querystring');

const server = 'https://avatar-changer-update-server.vercel.app'
const url = `${server}/update/${process.platform}/${app.getVersion()}`

autoUpdater.setFeedURL({ url })

// installer
if (require('electron-squirrel-startup')) return app.quit();

const store = new Store({ encryptionKey: "obfuscate" })
var win

const icons = {
  logo: path.join(__dirname, 'assets/legit.png'),
  ico: path.join(__dirname, 'assets/legit.ico'),
}


const createWindow = () => {
  // Create the browser window.
  win = new BrowserWindow({
    minWidth: 600,
    minHeight: 500,
    width: 600,
    height: 500,
    // maxWidth: 600,
    // maxHeight: 500,
    backgroundColor: "#141414",
    title: "Global Avatar Changer",
    // opacity: 0.95,
    webPreferences: {
      // devTools: false,
      nodeIntegration: true
    },
    icon: process.platform === "linux" ? icons.logo : icon.ico
  });

  win.setMenuBarVisibility(false);

  const handleRedirect = (e, url) => {
    if (url !== e.sender.getURL()) {
      e.preventDefault()
      console.log(url);
      shell.openExternal(url)
    }
  }
  win.webContents.on('will-navigate', handleRedirect);
  win.loadFile(path.join(__dirname, 'pages/index.html'));

  // mainWindow.webContents.openDevTools();
};

// Notify of update
if(fs.existsSync(path.resolve(path.dirname(process.execPath), '..', 'Update.exe'))){
  autoUpdater.on('update-downloaded', (e, releaseNotes, releaseName) => {
    console.log("[global-pfp-changer] update downloaded")
    console.log(e, releaseNotes, releaseName)
    win.webContents.send("log", "[global-pfp-changer] update downloaded")
    win.webContents.send("log", {notes: releaseNotes, name: releaseName})
    win.webContents.send("update", {notes: releaseNotes, name: releaseName})
  })
  autoUpdater.on('update-available', (e, releaseNotes, releaseName) => {
    console.log(e, releaseNotes, releaseName)
    win.webContents.send("log", "[global-pfp-changer] update available, downloading...")
  })
  // Check for updates
  setInterval(() => {
    autoUpdater.checkForUpdates()
  }, 60000)
  // Install updates
  ipcMain.on("update", (e, arg) => {
    autoUpdater.quitAndInstall()
  })
  autoUpdater.on('error', message => {
    win.webContents.send("log", message)
    console.log(message)
  })
}

app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

let avatarPath

ipcMain.on("avatarPath", (e, arg) => {
  console.log(arg)
  avatarPath = arg
})

ipcMain.on("updateAvatar", async (e, arg) => {
  let change = await changepfp(avatarPath)
  if(change === "error"){ return }
  e.reply("updateComplete")
})


async function changepfp(avatarPath) {

  const fs = require('fs')
  const readline = require('readline')
  const puppeteer = require('puppeteer')
  const request = require('request')
  // const config = require('./config')
  const config = store.get("settings")
  const avatarFile = avatarPath;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let input
  var pfp = {};
  var authCode;

  async function imgToBase64() {
    pfp.uri = `data:image/${path.extname(avatarFile)};base64,${await fs.readFileSync(avatarFile, "base64")}`
  }


  await imgToBase64();

  const browser = await puppeteer.launch({ headless: !(await store.get("debug")) })
  const pages = await browser.pages()
  const page = pages[0] ? pages[0] : browser.newPage()
  await page.setViewport({ width: 1000, height: 1000 })
  if(config.twitter.enabled){
    //   login to twitter
    await page.goto('https://twitter.com/login')
    await page.waitFor('input[name="session[username_or_email]"]')
    await page.waitFor('input[name="session[password]"]')
    await page.type('input[name="session[username_or_email]"]', config.twitter.username, { delay: 0 })
    await page.type('input[name="session[password]"]', config.twitter.password, { delay: 0 })
    page.click('div[data-testid="LoginForm_Login_Button"]')
    await page.waitForNavigation()
    // check if logged in
    if(page.url().startsWith("https://twitter.com/login")){
      win.webContents.send("error", "Incorrect login details for Twitter")
      await browser.close()
      return "error"
    }
    // check for auth code
    while(page.url().startsWith("https://twitter.com/account/login_challenge")){
      // loop until auth code is correct
      let el = await page.$("strong")
      let inner = el.evaluate(el => el.innerHTML)
      let check =  stringify(inner).startsWith("Your phone number ends in")
      if(check){
        win.webContents.send("authCode", "Phone number for Twitter")
      } else {
        win.webContents.send("authCode", "Auth code for Twitter")
      }
      authCode = await waitForAuth()
      await page.waitFor('input[id="challenge_response"]')
      await page.type('input[id="challenge_response"]', authCode, { delay: 0 })
      await page.click('input[id="email_challenge_submit"]')
      await sleep(1000)
    }
    await page.goto('https://twitter.com/login')
    
    //    redirect to profile
    await page.waitFor('a[aria-label="Profile"]')
    await page.click('a[aria-label="Profile"]')
    await page.waitFor('a[href="/settings/profile"]')
    await page.click('a[href="/settings/profile"]')
    //    upload image
    await page.waitFor('input[accept="image/jpeg,image/png,image/webp"]')
    input = await page.$$('input[accept="image/jpeg,image/png,image/webp"]')
    await input[1].uploadFile(avatarFile)
    await sleep(500)
    await page.keyboard.press("Tab")
    await page.keyboard.press("Enter")
    await sleep(500)
    await page.click('div[data-testid="Profile_Save_Button"]')
    await sleep(500)
    console.log("[global-pfp-updt] Twitter updated...") 
  }
  if(config.github.enabled){
    // login to github
    await page.goto('https://github.com/login')
    await page.waitFor('input[name="login"]')
    await page.waitFor('input[name="password"]')
    await page.type('input[name="login"]', config.github.username, { delay: 0 })
    await page.type('input[name="password"]', config.github.password, { delay: 0 })
    await page.click('input[value="Sign in"]')
    await page.waitForNavigation()
    // check if logged in
    if(await page.url().startsWith("https://github.com/login")){
      win.webContents.send("error", "Incorrect login details for GitHub")
      await browser.close()
      return "error"
    }
    // check for auth code
    while((await page.url().startsWith("https://github.com/sessions/verified-device") || await page.url().startsWith("https://github.com/sessions/two-factor"))){
      // loop until auth code is correct
      let check = await page.$("label[for='otp']")
      if(check){
        win.webContents.send("authCode", "Auth code for GitHub")
      }
      authCode = await waitForAuth()
      await page.waitFor('input[id="otp"]')
      await page.type('input[id="otp"]', authCode, { delay: 0 })
      await page.click('button[type="submit"]')
      await sleep(1000)
    }
    // redirect to settings
    await page.waitFor('.avatar.avatar-user')
    await page.goto('https://github.com/settings/profile')
    await page.waitFor('input[id="avatar_upload"]')
    input = await page.$('input[id="avatar_upload"]')
    await input.uploadFile(avatarFile)
    await page.waitFor('button[name="op"][value="save"]')
    await page.click('button[name="op"][value="save"]')
    await page.waitForNavigation()
    console.log("[global-pfp-updt] GitHub updated...")
  }
  if(config.instagram.enabled){
    //  login to instagram
    await page.goto("https://www.instagram.com/")
    await page.waitFor('input[name="username"]')
    await page.waitFor('input[name="password"]')
    await page.type('input[name="username"]', config.instagram.username, { delay: 0 })
    await page.type('input[name="password"]', config.instagram.password, { delay: 0 })
    await page.click('button[type="submit"]')
    await sleep(3500)

    let check = await page.$('p[role="alert"]')
    if(check){
      win.webContents.send("error", "Incorrect login details for Instagram")
      await browser.close()
      return "error"
    }

    //    check for auth code
    let challenge = await page.$('.not-logged-in')
    if (challenge) {
      //   request auth code
      await page.waitFor('button')
      input = await page.$$('button')
      await input[1].click()
      await page.waitFor("#security_code")
    }
    
    while(await page.$('#security_code')){
      let auth = await page.$('#security_code')
      // loop until auth code is correct
      win.webContents.send("authCode", "Auth code for Instagram")
      authCode = await waitForAuth()
      await auth.click({clickCount: 3});
      await auth.press('Backspace'); 
      await page.type('#security_code', authCode, { delay: 0 })
      let input = await page.$$('button')
      await input[1].click()
      await sleep(2500)
    }

    await sleep(1000)
    await page.goto("https://www.instagram.com/accounts/edit/")
    await page.waitFor('input[accept="image/jpeg,image/png"]')
    input = await page.$$('input[accept="image/jpeg,image/png"]')
    await input[1].uploadFile(avatarFile)
    console.log("[global-pfp-updt] Instagram updated...")
  }
  if(config.steam.enabled){
    // login to steam
    await page.goto("https://steamcommunity.com/login")
    await page.waitFor('input[name="username"]')
    await page.waitFor('input[name="password"]')
    await page.type('input[name="username"]', config.steam.username, { delay: 0 })
    await page.type('input[name="password"]', config.steam.password, { delay: 0 })
    await page.click('.login_btn').catch(err => console.log(err))
    await sleep(2500)

    let check = await page.$('.newmodal')
    if(await page.url().startsWith("https://steamcommunity.com/login") && check === null){
      win.webContents.send("error", "Incorrect login details for Steam")
      await browser.close()
      return "error"
    }
    let i = 0
    while(await page.$('#authcode')){
      let auth = await page.$('#authcode')
      // loop until auth code is correct
      win.webContents.send("authCode", "Auth code for Steam")
      authCode = await waitForAuth()
      await auth.click({clickCount: 3});
      await auth.press('Backspace'); 
      await page.type('#authcode', authCode, { delay: 0 })
      input = await page.$('#auth_buttonset_entercode .leftbtn')
      let otherInput = await page.$('#auth_buttonset_incorrectcode .leftbtn')
      console.log(i)
      if(i > 0){ 
        await otherInput.click() }
      else{
        input.click();
        await sleep(3000)
        page.click("#success_continue_btn").catch(err => console.log(err));
      }
      i++
      await sleep(2500)
    }
    page.goto("https://steamcommunity.com/id/jaronxp/edit/avatar").catch(err => console.log(err))
    await page.waitFor('input[accept="image/*"]')
    input = await page.$$('input[accept="image/*"]')
    await input[0].uploadFile(avatarFile)
    await sleep(1500);
    page.click(".DialogButton._DialogLayout.Primary")
    await sleep(2000);
    console.log("[global-pfp-updt] Steam updated...")
  }
  await browser.close()
  if(config.discord.enabled){
    let options = {
      headers: {
        "Authorization": `${config.discord.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ avatar: pfp.uri })
    }
    await request.patch('https://discord.com/api/v6/users/@me', options, async (err, res, body) => {
      if (err) {
        win.webContents.send("error", "Discord API error: " + err.message)
        return "error"
      }
      console.log(body)
    })
  }
}

async function sleep(time) {
  await new Promise((res, rej) => {  
    setTimeout(async () => {
      res()
    }, time)
  })
}

async function waitForAuth(){
  return await new Promise((res, rej) => {
    ipcMain.once("authCode", (e, arg) => {
      res(arg)
    })
  })
}