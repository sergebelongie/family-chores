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

// DOMContentLoaded safety check
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("note-modal");
  if (modal) {
    modal.classList.add("hidden");
  }
});

// Utility
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function showToast(message = "✅ Chore logged!") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 300);
  }, 1500);
}

// Chore Logging
async function logChore(choreName, note = "") {
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;

  await addDoc(collection(db, "logs"), {
    user: selectedUser,
    chore: choreName,
    timestamp: Timestamp.now(),
    note,
    week
  });

  showToast(`✅ Logged: ${choreName}`);
}

// Other chore with required note
async function logOtherChore() {
  let note = "";
  while (!note) {
    note = prompt("Describe the chore you completed:");
    if (note === null) return;
    note = note.trim();
  }

  await logChore("Other", note);
}

// Render buttons
function renderChoreButtons() {
  const container = document.getElementById("chore-buttons");
  container.innerHTML = "";

  categorizedChores.forEach(group => {
    group.chores.forEach(chore => {
      const button = document.createElement("button");
      button.className = `chore-button ${group.colorClass}`;
      button.textContent = chore;
      button.onclick = () => openNotePrompt(chore);
      container.appendChild(button);
    });
  });

  const otherButton = document.createElement("button");
  otherButton.className = "chore-button other";
  otherButton.textContent = "Other";
  otherButton.onclick = logOtherChore;
  container.appendChild(otherButton);
}

// Chore history
async function showChoreHistory() {
  const historySection = document.getElementById("chore-history");
  const historyList = document.getElementById("history-list");
  historyList.innerHTML = "";

  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const q = query(
    collection(db, "logs"),
    where("user", "==", selectedUser),
    where("timestamp", ">", Timestamp.fromDate(oneWeekAgo)),
    orderBy("timestamp", "desc")
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const data = doc.data();
    const dateObj = data.timestamp.toDate();
    const dateStr = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const noteStr = data.note ? `<br><em>Note:</em> ${data.note}` : "";

    const item = document.createElement("li");
    item.innerHTML = `<strong>${data.chore}</strong><br><small>${dateStr}, ${timeStr}</small>${noteStr}`;
    historyList.appendChild(item);
  });

  historySection.classList.remove("hidden");
}

// UI Navigation
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

function selectUser(user) {
  selectedUser = user;
  document.getElementById("user-select").classList.add("hidden");
  document.getElementById("chore-logger").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.add("hidden");
  document.getElementById("pin-entry").classList.remove("hidden");

  pinBuffer = [];
  updatePinDisplay();
  document.getElementById("pin-status").textContent = "";
  generateKeypad();
}

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

  if (pinBuffer.length === 4) {
    submitPIN();
  }
}

// Modal for notes
function openNotePrompt(choreName) {
  if (!choreName) return;
  const modal = document.getElementById("note-modal");
  const choreLabel = document.getElementById("note-chore-name");
  const input = document.getElementById("note-input");
  const submitBtn = document.getElementById("submit-note");
  const cancelBtn = document.getElementById("cancel-note");

  choreLabel.textContent = choreName;
  input.value = "";
  modal.classList.remove("hidden");

  cancelBtn.onclick = () => {
    modal.classList.add("hidden");
  };

  submitBtn.onclick = async () => {
    const note = input.value.trim();
    modal.classList.add("hidden");
    await logChore(choreName, note);
  };
}

// Admin dashboard placeholder
function showAdminDashboard() {
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.remove("hidden");

  // Add your existing dashboard log loading logic here
}

// Build info
const buildElement = document.getElementById("build-info");
const now = new Date();
const version = "v1.0";
const timestamp = now.toLocaleString(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});
buildElement.textContent = `${version} • Built ${timestamp}`;

// Expose functions
window.selectUser = selectUser;
window.submitPIN = submitPIN;
window.showChoreHistory = showChoreHistory;
window.exitToHome = exitToHome;
window.logOtherChore = logOtherChore;
window.filterAdminLogs = filterAdminLogs;
window.exportCSV = exportCSV;