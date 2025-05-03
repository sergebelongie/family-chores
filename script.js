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

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function logChore(choreName) {
  const note = prompt(`Optional note for: ${choreName}`, "");
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const logRef = doc(db, "logs", `${selectedUser}_${week}`);

  await setDoc(logRef, { user: selectedUser, week }, { merge: true });

  await updateDoc(logRef, {
    entries: arrayUnion({
      chore: choreName,
      timestamp: now.toISOString(),
      note: note || ""
    })
  });

  async function logOtherChore() {
    let note = "";
    while (!note) {
      note = prompt("Describe the chore you completed:");
      if (note === null) return; // user hit cancel
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

  document.getElementById("log-status").textContent = `✅ Logged: ${choreName}`;
  setTimeout(() => {
    document.getElementById("log-status").textContent = "";
  }, 1500);
}

function renderChoreButtons() {
    const container = document.getElementById("chore-buttons");
    container.innerHTML = "";
  
    // Render regular chores
    allChores.forEach(chore => {
      const button = document.createElement("button");
      button.className = "chore-button";
      button.textContent = chore;
      button.onclick = () => logChore(chore);
      container.appendChild(button);
    });
  
    // Add special "Other" button
    const otherButton = document.createElement("button");
    otherButton.className = "chore-button other";
    otherButton.textContent = "Other";
    otherButton.onclick = () => logOtherChore();
    container.appendChild(otherButton);
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

// Enable submitting PIN with Enter
document.getElementById("pin-input").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    submitPIN();
  }
});

// Expose functions to HTML
window.selectUser = selectUser;
window.submitPIN = submitPIN;
window.showChoreHistory = showChoreHistory;
window.exitToHome = exitToHome;