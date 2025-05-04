import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  addDoc,
  collection,
  Timestamp,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { firebaseConfig } from './firebase-config.js';
import { categorizedChores } from './chores.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let selectedUser = null;
let pinBuffer = [];

// Utility to get current week label
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Log chore with modal
function openNotePrompt(choreName) {
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

    const now = new Date();
    const week = `${now.getFullYear()}-W${getWeekNumber(now)}`;

    await addDoc(collection(db, "logs"), {
      user: selectedUser,
      chore: choreName,
      timestamp: Timestamp.now(),
      note: note || "",
      week
    });

    showToast(`✅ Logged: ${choreName}`);
  };
}

// Show toast
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

// Show user's chore log for past week
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
    const date = data.timestamp.toDate();
    const dateStr = date.toLocaleDateString();
    const timeStr = date.toLocaleTimeString();
    const note = data.note ? `<br><em>Note:</em> ${data.note}` : "";
    const item = document.createElement("li");
    item.innerHTML = `${data.chore} – <small>${dateStr}, ${timeStr}</small>${note}`;
    historyList.appendChild(item);
  });

  historySection.classList.remove("hidden");
}

// Show filtered logs in admin dashboard
async function filterAdminLogs() {
  const startInput = document.getElementById("filter-start").value;
  const endInput = document.getElementById("filter-end").value;
  const dashboardList = document.getElementById("admin-log-list");
  dashboardList.innerHTML = "";

  if (!startInput || !endInput) {
    dashboardList.innerHTML = "<li>Please select both start and end dates.</li>";
    return;
  }

  const startDate = new Date(startInput);
  const endDate = new Date(endInput);
  endDate.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, "logs"),
    where("timestamp", ">=", Timestamp.fromDate(startDate)),
    where("timestamp", "<=", Timestamp.fromDate(endDate)),
    orderBy("timestamp", "desc")
  );

  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    dashboardList.innerHTML = "<li>No logs found in that range.</li>";
    return;
  }

  snapshot.forEach(doc => {
    const data = doc.data();
    const ts = data.timestamp.toDate();
    const date = ts.toLocaleDateString();
    const time = ts.toLocaleTimeString();
    const note = data.note ? `<br><em>Note:</em> ${data.note}` : "";
    const item = document.createElement("li");
    item.innerHTML = `<strong>${data.user}</strong> — ${data.chore}<br><small>${date}, ${time}</small>${note}`;
    dashboardList.appendChild(item);
  });
}

// CSV Export
function exportCSV() {
  const startInput = document.getElementById("filter-start").value;
  const endInput = document.getElementById("filter-end").value;

  if (!startInput || !endInput) {
    alert("Please select both start and end dates before exporting.");
    return;
  }

  const startDate = new Date(startInput);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(endInput);
  endDate.setHours(23, 59, 59, 999);

  const q = query(
    collection(db, "logs"),
    where("timestamp", ">=", Timestamp.fromDate(startDate)),
    where("timestamp", "<=", Timestamp.fromDate(endDate)),
    orderBy("timestamp", "desc")
  );

  getDocs(q).then(snapshot => {
    if (snapshot.empty) {
      alert("No logs found in that range.");
      return;
    }

    const rows = [["User", "Chore", "Note", "Date", "Time"]];
    snapshot.forEach(doc => {
      const data = doc.data();
      const ts = data.timestamp.toDate();
      rows.push([
        data.user,
        data.chore,
        data.note || "",
        ts.toLocaleDateString(),
        ts.toLocaleTimeString()
      ]);
    });

    const csvContent = rows.map(r => r.map(f => `"${f}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `chore_logs_${startInput}_to_${endInput}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

// Admin view
function showAdminDashboard() {
  document.getElementById("pin-entry").classList.add("hidden");
  document.getElementById("admin-dashboard").classList.remove("hidden");
  filterAdminLogs(); // show current logs
}

// Chore buttons
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
  otherButton.onclick = () => openNotePrompt("Other");
  container.appendChild(otherButton);
}

// PIN Keypad
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
  } else if (pinBuffer.length < 4) {
    pinBuffer.push(key);
  }

  updatePinDisplay();

  if (pinBuffer.length === 4) {
    submitPIN();
  }
}

function updatePinDisplay() {
  const display = document.getElementById("pin-display");
  display.textContent = pinBuffer.map(() => "●").join(" ") || "- - - -";
}

// Submit PIN
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

  document.getElementById("pin-entry").classList.add("hidden");

  if (selectedUser === "admin") {
    showAdminDashboard();
  } else {
    document.getElementById("chore-logger").classList.remove("hidden");
    document.getElementById("user-title").textContent = `${userData.displayName}'s Chores`;
    renderChoreButtons();
  }
}

// User selects name
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

// Exit back to user select
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

// Build/version info
const buildElement = document.getElementById("build-info");
const now = new Date();
const version = "v1.0";
const timestamp = now.toLocaleString(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});
buildElement.textContent = `${version} • Built ${timestamp}`;

// Expose
window.selectUser = selectUser;
window.submitPIN = submitPIN;
window.showChoreHistory = showChoreHistory;
window.exitToHome = exitToHome;
window.filterAdminLogs = filterAdminLogs;
window.exportCSV = exportCSV;