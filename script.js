import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from './firebase-config.js';
import { allChores } from './chores.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let selectedUser = null;
let pendingChore = null;

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function renderChoreButtons() {
  const container = document.getElementById("chore-buttons");
  container.innerHTML = "";
  allChores.forEach(chore => {
    const button = document.createElement("button");
    button.className = "chore-button";
    button.textContent = chore;
    button.onclick = () => openNotePrompt(chore);
    container.appendChild(button);
  });
}

function openNotePrompt(choreName) {
  pendingChore = choreName;
  document.getElementById("note-prompt-text").textContent = `Optional note for: ${choreName}`;
  document.getElementById("note-input").value = "";
  document.getElementById("note-modal").classList.remove("hidden");

  setTimeout(() => {
    document.getElementById("note-input").focus();
  }, 10);
}

async function submitNote() {
  const note = document.getElementById("note-input").value;
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const logRef = doc(db, "logs", `${selectedUser}_${week}`);

  await setDoc(logRef, { user: selectedUser, week }, { merge: true });

  await updateDoc(logRef, {
    entries: arrayUnion({
      chore: pendingChore,
      timestamp: now.toISOString(),
      note: note || ""
    })
  });

  document.getElementById("note-modal").classList.add("hidden");
  document.getElementById("log-status").textContent = `✅ Logged: ${pendingChore}`;
  pendingChore = null;

  setTimeout(() => {
    document.getElementById("log-status").textContent = "";
  }, 1500);
}

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

function exitToHome() {
  selectedUser = null;
  document.getElementById("pin-input").value = "";
  document.getElementById("pin-status").textContent = "";
  document.getElementById("user-select").classList.remove("hidden");
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("chore-logger").classList.add("hidden");
  document.getElementById("chore-history").classList.add("hidden");
  document.getElementById("history-list").innerHTML = "";
}

// Global handlers for HTML buttons
function selectUser(userId) {
  selectedUser = userId;
  document.getElementById("user-select").classList.add("hidden");
  document.getElementById("pin-entry").classList.remove("hidden");
  document.getElementById("pin-input").focus();
}

async function submitPIN() {
  const inputPIN = document.getElementById("pin-input").value;
  const userRef = doc(db, "users", selectedUser);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    document.getElementById("pin-status").textContent = "User not found.";
    return;
  }

  const userData = userSnap.data();
  if (userData.pin !== inputPIN) {
    document.getElementById("pin-status").textContent = "Incorrect PIN.";
    return;
  }

  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("chore-logger").classList.remove("hidden");
  document.getElementById("user-title").textContent = `${userData.displayName}'s Chores`;
  renderChoreButtons();
}

function closeNoteModal() {
    document.getElementById("note-modal").classList.add("hidden");
  }

// Submit PIN with Enter key
document.getElementById("pin-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitPIN();
  }
});

// temporary debug step to suppress modal window
document.getElementById("note-modal").classList.add("hidden");

// Make functions accessible to HTML
window.selectUser = selectUser;
window.submitPIN = submitPIN;
window.showChoreHistory = showChoreHistory;
window.exitToHome = exitToHome;
window.submitNote = submitNote;