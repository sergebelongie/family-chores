// Import Firebase modules from CDN
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

// Initialize Firebase app and Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Define the list of chores (can be expanded)
const allChores = [
  "Brush teeth",
  "Make bed",
  "Feed guinea pigs",
  "Put away toys",
  "Read independently",
  "Pack school bag"
];

let selectedUser = null;

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

async function logChore(choreName) {
  const now = new Date();
  const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;
  const logRef = doc(db, "logs", `${selectedUser}_${week}`);

  await setDoc(logRef, {
    user: selectedUser,
    week,
  }, { merge: true });

  await updateDoc(logRef, {
    entries: arrayUnion({
      chore: choreName,
      timestamp: now.toISOString()
    })
  });

  document.getElementById("log-status").textContent = `✅ Logged: ${choreName}`;
  setTimeout(() => {
    document.getElementById("log-status").textContent = "";
  }, 1500);
}

function renderChoreButtons() {
  const container = document.getElementById("chore-buttons");
  container.innerHTML = "";
  allChores.forEach(chore => {
    const button = document.createElement("button");
    button.className = "chore-button";
    button.textContent = chore;
    button.onclick = () => logChore(chore);
    container.appendChild(button);
  });
}

// Make these functions available to the HTML buttons
window.selectUser = async function(userId) {
  selectedUser = userId;
  document.getElementById("user-select").classList.add("hidden");
  document.getElementById("pin-entry").classList.remove("hidden");
};

window.submitPIN = async function() {
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
};