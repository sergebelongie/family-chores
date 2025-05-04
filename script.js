import { firebaseConfig } from "./firebase-config.js";
import { allChores } from "./chores.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.10.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  collection,
  addDoc,
  Timestamp,
  query,
  where,
  getDocs,
  orderBy
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

function renderChoreButtons() {
  const container = document.getElementById("chore-buttons");
  container.innerHTML = "";

  allChores.forEach(chore => {
    const btn = document.createElement("button");
    btn.className = "chore-button";
    btn.textContent = chore;
    btn.onclick = () => logChore(chore);
    container.appendChild(btn);
  });

  const otherButton = document.createElement("button");
  otherButton.className = "chore-button other";
  otherButton.textContent = "❓ Other";
  otherButton.onclick = () => logOtherChore();
  container.appendChild(otherButton);
}

function logChore(choreName, note = "") {
  const logEntry = {
    user: selectedUser,
    chore: choreName,
    note: note || null,
    timestamp: Timestamp.now()
  };
  addDoc(collection(db, "logs"), logEntry)
    .then(() => {
      document.getElementById("log-status").textContent = `✅ Logged: ${choreName}`;
      setTimeout(() => {
        document.getElementById("log-status").textContent = "";
      }, 2000);
    });
}

function logOtherChore() {
  const note = prompt("What chore did you do?");
  if (note) {
    logChore("Other", note);
  }
}

function showChoreHistory() {
  document.getElementById("chore-history").classList.remove("hidden");
  const list = document.getElementById("history-list");
  list.innerHTML = "";

  const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const logsRef = collection(db, "logs");
  const q = query(
    logsRef,
    where("user", "==", selectedUser),
    where("timestamp", ">", oneWeekAgo),
    orderBy("timestamp", "desc")
  );

  getDocs(q).then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement("li");
      const date = data.timestamp.toDate().toLocaleString();
      item.textContent = `${date} — ${data.chore}${data.note ? " (" + data.note + ")" : ""}`;
      list.appendChild(item);
    });
  });
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
  document.getElementById("log-status").textContent = "";
  document.getElementById("splash-screen").classList.remove("hidden");
}

// Show build timestamp
document.getElementById("build-timestamp").textContent = new Date().toLocaleString();

// Expose functions for HTML button onclick handlers
window.selectUser = selectUser;
window.exitToHome = exitToHome;
window.showChoreHistory = showChoreHistory;