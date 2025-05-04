import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.10.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let selectedUser = null;
let pinBuffer = [];

function selectUser(userId) {
  selectedUser = userId;
  pinBuffer = [];
  updatePinDisplay();
  generateKeypad();
  document.getElementById("splash-screen").classList.add("hidden");
  document.getElementById("pin-entry").classList.remove("hidden");
}

function updatePinDisplay() {
  const pinDisplay = document.getElementById("pin-display");
  pinDisplay.textContent = pinBuffer.map(() => "●").join(" ") || "- - - -";
}

function generateKeypad() {
  const keys = ['1','2','3','4','5','6','7','8','9','←','0','✅'];
  const keypad = document.getElementById("pin-keypad");
  keypad.innerHTML = "";

  keys.forEach(key => {
    const btn = document.createElement("div");
    btn.className = "pin-key";
    btn.textContent = key;
    btn.onclick = () => handleKey(key);
    keypad.appendChild(btn);
  });
}

function handleKey(key) {
  if (key === '←') {
    pinBuffer.pop();
  } else if (key === '✅') {
    submitPIN(pinBuffer.join(""));
    return;
  } else if (pinBuffer.length < 6) {
    pinBuffer.push(key);
  }
  updatePinDisplay();
}

async function submitPIN(inputPIN) {
  const userRef = doc(db, "users", selectedUser);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    document.getElementById("pin-status").textContent = "User not found.";
    pinBuffer = [];
    updatePinDisplay();
    return;
  }

  const userData = userSnap.data();
  if (userData.pin !== inputPIN) {
    document.getElementById("pin-status").textContent = "Incorrect PIN.";
    pinBuffer = [];
    updatePinDisplay();
    return;
  }

  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("chore-logger").classList.remove("hidden");
  document.getElementById("user-title").textContent = `${userData.displayName}'s Chores`;
  renderChoreButtons();
}

function exitToHome() {
  selectedUser = null;
  pinBuffer = [];
  updatePinDisplay();
  document.getElementById("pin-status").textContent = "";
  document.getElementById("user-select").classList.remove("hidden");
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("chore-logger").classList.add("hidden");
  document.getElementById("chore-history").classList.add("hidden");
  document.getElementById("history-list").innerHTML = "";
  document.getElementById("splash-screen").classList.remove("hidden");
}

document.getElementById("build-timestamp").textContent = new Date().toLocaleString();

window.selectUser = selectUser;
window.exitToHome = exitToHome;