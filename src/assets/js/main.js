const path = require("path")
const { ipcRenderer } = require('electron')
const Store = require('electron-store');

const store = new Store({ encryptionKey: "obfuscate" });

let avatar = document.getElementById("avatar")
let file = document.getElementById("file");
let drop = document.getElementById("holder");
let updtbtn = document.getElementById("update");
let authInput = document.getElementById("authCode");
let authHeader = document.getElementById("authHeader");
let errmsg = document.querySelector(".ui.warning.message");
let succmsg = document.querySelector(".ui.positive.message");

// discord
let denabled = document.getElementById("denabled");
let dtoken = document.getElementById("dtoken");
// twitter
let tenabled = document.getElementById("tenabled");
let tusername = document.getElementById("tusername");
let tpassword = document.getElementById("tpassword");
// github
let ghenabled = document.getElementById("ghenabled");
let ghusername = document.getElementById("ghusername");
let ghpassword = document.getElementById("ghpassword");
// instagram
let instaenabled = document.getElementById("instaenabled");
let instausername = document.getElementById("instausername");
let instapassword = document.getElementById("instapassword");

// other
let circular = document.getElementById("circular");
let debug = document.getElementById("debug");

let avatarPath;

// accept file
document.addEventListener('drop', (e) => {
  e.preventDefault();
  e.stopPropagation();

  console.log(e.dataTransfer.files.length)
  if(!e.dataTransfer.files){
    return;
  }
  if(e.dataTransfer.files.length > 1){
    errmsg.innerHTML = "Please submit only one image..."
    errmsg.classList.remove("hidden")
  } else {
    for (const f of e.dataTransfer.files) {
      console.log('File(s) you dragged here: ', f.path)
      console.log(path.extname(f.path))
      if(![".jpg",".png",".gif"].includes(path.extname(f.path))){
        errmsg.innerHTML = "Please submit a valid image..."
        errmsg.classList.remove("hidden")
      } else {
        console.log("VALID")
        errmsg.classList.add("hidden")
        avatar.style.background = `url('${f.path.replace(/\\/g, "/")}') 50% 50% no-repeat`
        avatar.classList.remove("hidden")
        file.classList.add("hidden")
        avatarPath = f.path.replace(/\\/g, "/")
        ipcRenderer.send("avatarPath", avatarPath)
        updtbtn.classList.remove("disabled")
      }
    }
  }
});
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

updtbtn.addEventListener("click", (e) => {
  ipcRenderer.send("updateAvatar")
  updtbtn.classList.add("disabled")
  updtbtn.classList.add("loading")
})

// file drop styles
file.addEventListener("dragenter", change, false);
file.addEventListener("dragleave", change_back, false);

$("#circular").change(e => {
  avatar.classList.toggle("circle")
})

function change() {
  drop.style.opacity = '0.85';
};

function change_back() {
  drop.style.opacity = '1';
};

window.onload = () => {
  circular.checked = store.get("circular");
  debug.checked = store.get("debug");
  if(circular.checked){ avatar.classList.add("circle") }
  document.querySelector(".circular-option").addEventListener("click",(e) => {
    store.set("circular", circular.checked)
  })
  document.querySelector("#debug-option").addEventListener("click",(e) => {
    store.set("debug", debug.checked)
  })
  $('.message .close')
  .on('click', function() {
    $(this)
      .closest('.message')
      .transition('fade')
    ;
  });
  $('.ui.modal')
  .modal({
    duration: "200",
    transition: "fade"
  });  
  $('#authModal')
  .modal({
    closable: false,
    onApprove: (el) => {
      ipcRenderer.send("authCode", authInput.value)
      authInput.value = ""
    }
  });
  $('#settingsModal')
  .modal({
    onApprove: async (el) => {
      let settings = {
        discord: {
          enabled: denabled.checked,
          token: dtoken.value
        },
        twitter: {
          enabled: tenabled.checked,
          username: tusername.value,
          password: tpassword.value
        },
        github: {
          enabled: ghenabled.checked,
          username: ghusername.value,
          password: ghpassword.value
        },
        instagram: {
          enabled: instaenabled.checked,
          username: instausername.value,
          password: instapassword.value
        }
      }
      await store.set({
        settings: settings
      })
    }
  });
  document.getElementById("info").addEventListener("click", async (e) => {
    $('#infoModal')
    .modal('show');
  })
  document.getElementById("settings").addEventListener("click", async (e) => {
    let settings = await store.get("settings")
    if(settings){
      denabled.checked = settings.discord.enabled
      dtoken.value = settings.discord.token

      tenabled.checked = settings.twitter.enabled
      tusername.value = settings.twitter.username
      tpassword.value = settings.twitter.password
      
      ghenabled.checked = settings.github.enabled
      ghusername.value = settings.github.username
      ghpassword.value = settings.github.password
      
      instaenabled.checked = settings.instagram.enabled
      instausername.value = settings.instagram.username
      instapassword.value = settings.instagram.password
    }
    
    $('#settingsModal')
    .modal('show');
  })
  $("authInput").on('keyup', function (e) {
    if (e.keyCode === 13) {
        
    }
});
}

ipcRenderer.on("updateComplete", (e, arg) => {
  succmsg.innerHTML = "Avatars successfully updated!"
  succmsg.classList.remove("hidden")
  updtbtn.classList.remove("disabled")
  updtbtn.classList.remove("loading")
  setTimeout(() => {
    $('.message.positive')
      .transition('fade');
  ;
  }, 2500)
})

ipcRenderer.on("authCode", (e, arg) => {
  authHeader.innerHTML = `${arg}`
  $('#authModal')
  .modal('show');
})

ipcRenderer.on("error", (e, arg) => {
  errmsg.innerHTML = arg
  errmsg.classList.remove("hidden")
  updtbtn.classList.remove("disabled")
  updtbtn.classList.remove("loading")
  setTimeout(() => {
    $('.message.warning')
      .transition('fade');
  ;
  }, 2500)
})