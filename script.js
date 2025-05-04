import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  collection,
  Timestamp,
  query,
  where,
  getDocs,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from './firebase-config.js';
import { categorizedChores } from './chores.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let selectedUser = null;
let pinBuffer = [];

// Get ISO-style week label
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Log predefined chore
async function logChore(choreName) {
  const note = prompt(`Optional note for: ${choreName}`, "");
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;

  await addDoc(collection(db, "logs"), {
    user: selectedUser,
    chore: choreName,
    timestamp: Timestamp.now(),
    note: note || "",
    week
  });

  document.getElementById("log-status").textContent = `✅ Logged: ${choreName}`;
  setTimeout(() => {
    document.getElementById("log-status").textContent = "";
  }, 1500);
}

// Log a custom "Other" chore with required note
async function logOtherChore() {
  let note = "";
  while (!note) {
    note = prompt("Describe the chore you completed:");
    if (note === null) return; // User canceled
    note = note.trim();
  }

  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const logRef = doc(db, "logs", `${selectedUser}_${week}`);

  await setDoc(logRef, { user: selectedUser, week }, { merge: true });

  await updateDoc(logRef, {
    entries: arrayUnion({
      chore: "Other",
      timestamp: now.toISOString(),
      note
    })
  });

  document.getElementById("log-status").textContent = `✅ Logged: ${note}`;
  setTimeout(() => {
    document.getElementById("log-status").textContent = "";
  }, 1500);
}

// Render buttons for each chore category + "Other"
function renderChoreButtons() {
  const container = document.getElementById("chore-buttons");
  container.innerHTML = "";

  categorizedChores.forEach(group => {
    group.chores.forEach(chore => {
      const button = document.createElement("button");
      button.className = `chore-button ${group.colorClass}`;
      button.textContent = chore;
      button.onclick = () => logChore(chore);
      container.appendChild(button);
    });
  });

  // Add special "Other" button
  const otherButton = document.createElement("button");
  otherButton.className = "chore-button other";
  otherButton.textContent = "Other";
  otherButton.onclick = logOtherChore;
  container.appendChild(otherButton);
}

// Show logged chores for current week
async function showChoreHistory() {
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const logRef = doc(db, "logs", `${selectedUser}_${week}`);
  const logSnap = await getDoc(logRef);
  const historyEl = document.getElementById("chore-history");
  const listEl = document.getElementById("history-list");

  if (!logSnap.exists()) {
    listEl.innerHTML = "<li>No chores logged yet.</li>";
  } else {
    const data = logSnap.data();
    const entries = data.entries || [];
    listEl.innerHTML = entries.map(entry => {
      const date = new Date(entry.timestamp).toLocaleString();
      return `<li>${entry.chore} – <small>${date}</small>${entry.note ? `<br><em>${entry.note}</em>` : ""}</li>`;
    }).join("");
  }

  historyEl.classList.remove("hidden");
}

// Go back to user select screen
function exitToHome() {
  selectedUser = null;
  pinBuffer = [];
  updatePinDisplay();
  document.getElementById("pin-status").textContent = "";
  document.getElementById("user-select").classList.remove("hidden");
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("chore-logger").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
  document.getElementById("chore-history").classList.add("hidden");
  document.getElementById("history-list").innerHTML = "";
}

// User selects their name
function selectUser(user) {
  selectedUser = user;
  document.getElementById("user-select").classList.add("hidden");
  document.getElementById("pin-entry").classList.remove("hidden");

  // ✅ Hide chore and admin screens in case they're still showing
  document.getElementById("chore-logger").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
}

// Check user PIN
async function submitPIN() {
  const inputPIN = pinBuffer.join("");
  const userDoc = await getDoc(doc(db, "users", selectedUser));

  if (!userDoc.exists()) {
    document.getElementById("pin-status").textContent = "User not found.";
    pinBuffer = [];
    updatePinDisplay();
    return;
  }

  const userData = userDoc.data();

  if (userData.pin !== inputPIN) {
    document.getElementById("pin-status").textContent = "Incorrect PIN.";
    pinBuffer = [];
    updatePinDisplay();
    return;
  }

  if (selectedUser === "admin") {
    showAdminDashboard();
  } else {
    document.getElementById("pin-entry").classList.add("hidden");
    document.getElementById("chore-logger").classList.remove("hidden");
    document.getElementById("user-title").textContent = `${userData.displayName}'s Chores`;
    renderChoreButtons();
  }
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
  if (key === "←") {
    pinBuffer.pop();
  } else {
    if (pinBuffer.length < 4) {
      pinBuffer.push(key);
    }
  }

  updatePinDisplay();

  // ✅ Auto-submit when 4 digits entered
  if (pinBuffer.length === 4) {
    submitPIN();
  }
}

function showAdminDashboard() {
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.remove("hidden");

  const dashboardList = document.getElementById("admin-log-list");
  dashboardList.innerHTML = "";

  const oneWeekAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const q = query(
    collection(db, "logs"),
    where("timestamp", ">", oneWeekAgo),
    orderBy("timestamp", "desc")
  );

  getDocs(q).then(snapshot => {
    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement("li");
      const dateObj = data.timestamp.toDate();
      const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      const noteStr = data.note ? `<br><em>Note:</em> ${data.note}` : "";

      item.innerHTML = `<strong>${data.user}</strong> — ${data.chore}<br><small>${dateStr}, ${timeStr}</small>${noteStr}`;
      dashboardList.appendChild(item);
    });
  });
}

// Expose functions globally
window.selectUser = selectUser;
window.submitPIN = submitPIN;
window.showChoreHistory = showChoreHistory;
window.exitToHome = exitToHome;
window.logOtherChore = logOtherChore;

// Build/version info
const buildElement = document.getElementById("build-info");
const now = new Date();
const version = "v1.0";  // You can bump this manually
const timestamp = now.toLocaleString(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});
buildElement.textContent = `${version} • Built ${timestamp}`;