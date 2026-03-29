import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://tppconarxspvuxodtbkj.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwcGNvbmFyeHNwdnV4b2R0YmtqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDg4NjYsImV4cCI6MjA5MDI4NDg2Nn0.PYuikJonJftna84AtFD8I4sNsLWDEOAXSF1EOyo2y6w";

// Initialize Supabase to strictly use in-memory storage (requires login on every reload)
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
  },
});

let allCandidates = [];

// 🔐 AUTHENTICATION STATE
supabase.auth.onAuthStateChange((event, session) => {
  if (session) {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
    fetchCandidates();
  } else {
    document.getElementById("loginSection").style.display = "flex";
    document.getElementById("appSection").style.display = "none";
  }
});

// 🔐 LOGIN
window.login = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) alert(error.message);
};

// 🔓 LOGOUT
window.logout = async () => {
  await supabase.auth.signOut();
};

// 📥 FETCH DATA
async function fetchCandidates() {
  const { data, error } = await supabase
    .from("candidates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching data:", error);
    return;
  }
  allCandidates = data;
  populateFilters();
  applyFilters();
}

// 📤 UPLOAD FILE HELPER
async function uploadResume(file) {
  const fileName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const { data, error } = await supabase.storage
    .from("resumes")
    .upload(fileName, file);

  if (error) {
    console.error("Upload Error:", error);
    throw error;
  }
  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from("resumes")
    .getPublicUrl(fileName);

  return publicUrlData.publicUrl;
}

// ➕ ADD CANDIDATE
document
  .getElementById("candidateForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();
    const addBtn = document.getElementById("addBtn");

    try {
      addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
      addBtn.disabled = true;

      let resumeLink = "";
      const fileInput = document.getElementById("resumeFile");

      if (fileInput.files.length > 0) {
        resumeLink = await uploadResume(fileInput.files[0]);
      }

      const newCandidate = {
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("emailInput").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        position: document.getElementById("position").value.trim(),
        exp: document.getElementById("exp").value || "",
        currentCTC: document.getElementById("currentCTC").value || "",
        expectedCTC: document.getElementById("expectedCTC").value || "",
        noticePeriod: document.getElementById("noticePeriod").value.trim(),
        location: document.getElementById("location").value.trim(),
        currentCompany: document.getElementById("currentCompany").value.trim(),
        targetCompany: document.getElementById("targetCompany").value.trim(),
        comment: document.getElementById("comment").value.trim(),
        status: document.getElementById("status").value,
        resumeURL: resumeLink,
      };

      const { error } = await supabase
        .from("candidates")
        .insert([newCandidate]);
      if (error) throw error;

      e.target.reset();
      fetchCandidates(); // Refresh table
    } catch (error) {
      alert("Error saving candidate!");
    } finally {
      addBtn.innerHTML = '<i class="fas fa-plus"></i> Add';
      addBtn.disabled = false;
    }
  });

// ❌ DELETE CANDIDATE
window.deleteCandidate = async (id) => {
  if (confirm("Are you sure you want to delete this candidate?")) {
    // 1. Find the candidate in our local array to get their resume URL
    const candidate = allCandidates.find((c) => c.id === id);

    // 2. If they have a resume, delete it from the Storage bucket first
    if (candidate && candidate.resumeURL) {
      // Extract just the filename from the end of the long URL
      const urlParts = candidate.resumeURL.split("/");
      const fileName = decodeURIComponent(urlParts[urlParts.length - 1]);

      const { error: storageError } = await supabase.storage
        .from("resumes")
        .remove([fileName]);

      if (storageError) console.error("Error deleting file:", storageError);
    }

    // 3. Now, delete the data row from the database
    const { error: dbError } = await supabase
      .from("candidates")
      .delete()
      .eq("id", id);

    if (!dbError) {
      fetchCandidates();
    } else {
      alert("Error deleting candidate record.");
    }
  }
};

// ✏️ EDIT MODAL LOGIC
let currentEditId = null;
let currentResumeUrl = "";

window.openEdit = function (id) {
  const c = allCandidates.find((x) => x.id === id);
  if (!c) return;

  currentEditId = id;
  currentResumeUrl = c.resumeURL || ""; // Store current URL

  document.getElementById("editName").value = c.name || "";
  document.getElementById("editEmail").value = c.email || "";
  document.getElementById("editPhone").value = c.phone || "";
  document.getElementById("editPosition").value = c.position || "";
  document.getElementById("editExp").value = c.exp || "";
  document.getElementById("editCurrentCTC").value = c.currentCTC || "";
  document.getElementById("editExpectedCTC").value = c.expectedCTC || "";
  document.getElementById("editNoticePeriod").value = c.noticePeriod || "";
  document.getElementById("editLocation").value = c.location || "";
  document.getElementById("editCurrentCompany").value = c.currentCompany || "";
  document.getElementById("editTargetCompany").value = c.targetCompany || "";
  document.getElementById("editComment").value = c.comment || "";
  document.getElementById("editStatus").value = c.status || "";
  document.getElementById("editResumeFile").value = ""; // Clear file input

  document.getElementById("editModal").style.display = "flex";
};

window.saveEdit = async function () {
  const saveBtn = document.getElementById("saveEditBtn");
  saveBtn.innerHTML = "Saving...";
  saveBtn.disabled = true;

  try {
    let updatedResumeLink = currentResumeUrl;
    const fileInput = document.getElementById("editResumeFile");

    // If a new file is selected, handle the swap to prevent orphaned files
    if (fileInput.files.length > 0) {
      // DELETE THE OLD FILE FIRST (if it exists)
      if (currentResumeUrl) {
        const urlParts = currentResumeUrl.split("/");
        const oldFileName = decodeURIComponent(urlParts[urlParts.length - 1]);
        await supabase.storage.from("resumes").remove([oldFileName]);
      }

      // THEN UPLOAD THE NEW FILE
      updatedResumeLink = await uploadResume(fileInput.files[0]);
    }

    const updatedData = {
      name: document.getElementById("editName").value.trim(),
      email: document.getElementById("editEmail").value.trim(),
      phone: document.getElementById("editPhone").value.trim(),
      position: document.getElementById("editPosition").value.trim(),
      exp: document.getElementById("editExp").value || "",
      currentCTC: document.getElementById("editCurrentCTC").value || "",
      expectedCTC: document.getElementById("editExpectedCTC").value || "",
      noticePeriod: document.getElementById("editNoticePeriod").value.trim(),
      location: document.getElementById("editLocation").value.trim(),
      currentCompany: document
        .getElementById("editCurrentCompany")
        .value.trim(),
      targetCompany: document.getElementById("editTargetCompany").value.trim(),
      comment: document.getElementById("editComment").value.trim(),
      status: document.getElementById("editStatus").value,
      resumeURL: updatedResumeLink,
    };

    const { error } = await supabase
      .from("candidates")
      .update(updatedData)
      .eq("id", currentEditId);

    if (error) throw error;

    closeModal();
    fetchCandidates();
  } catch (error) {
    alert("Failed to save changes.");
  } finally {
    saveBtn.innerHTML = "Save Changes";
    saveBtn.disabled = false;
  }
};

window.closeModal = function () {
  document.getElementById("editModal").style.display = "none";
};

// 📄 RESUME MODAL
window.openResumeModal = function (url) {
  const modal = document.getElementById("resumeModal");
  document.getElementById("downloadResumeBtn").href = url;
  document.getElementById("resumeIframe").src = url;
  modal.style.display = "flex";
};

window.closeResumeModal = function () {
  document.getElementById("resumeModal").style.display = "none";
  document.getElementById("resumeIframe").src = "";
};

// 🔍 FILTERS & RENDER TABLE (Same Logic)
function populateFilters() {
  const positionSet = new Set();
  const expSet = new Set();
  allCandidates.forEach((c) => {
    if (c.position) positionSet.add(c.position);
    if (c.exp) expSet.add(Number(c.exp));
  });

  const positionFilter = document.getElementById("positionFilter");
  positionFilter.innerHTML = '<option value="">All Positions</option>';
  positionSet.forEach((pos) => {
    positionFilter.innerHTML += `<option value="${pos}">${pos}</option>`;
  });

  const expFilter = document.getElementById("expFilter");
  expFilter.innerHTML = '<option value="">All Experience</option>';
  const expArray = [...expSet].sort((a, b) => a - b);
  if (expArray.length > 0) {
    for (let i = expArray[0]; i <= expArray[expArray.length - 1]; i += 3) {
      expFilter.innerHTML += `<option value="${i}-${i + 2}">${i}-${i + 2} years</option>`;
    }
  }
}

function applyFilters() {
  const position = document.getElementById("positionFilter").value;
  const expRange = document.getElementById("expFilter").value;
  const search = document.getElementById("search").value.toLowerCase();

  let filtered = [...allCandidates];
  if (position) filtered = filtered.filter((c) => c.position === position);
  if (expRange) {
    const [min, max] = expRange.split("-").map(Number);
    filtered = filtered.filter((c) => {
      const exp = Number(c.exp);
      return !isNaN(exp) && exp >= min && exp <= max;
    });
  }
  if (search) {
    filtered = filtered.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.position.toLowerCase().includes(search) ||
        c.phone.includes(search),
    );
  }
  renderTable(filtered);
}

function renderTable(list) {
  const table = document.getElementById("tableBody");
  table.innerHTML = "";
  const fields = [
    "name",
    "position",
    "exp",
    "currentCTC",
    "expectedCTC",
    "noticePeriod",
    "location",
    "phone",
    "email",
    "currentCompany",
    "targetCompany",
    "comment",
    "status",
  ];

  list.forEach((c) => {
    const viewResumeBtn = c.resumeURL
      ? `<button class="action-btn view-btn" onclick="openResumeModal('${c.resumeURL}')" title="View Resume"><i class="fas fa-link"></i></button>`
      : `<button class="action-btn" disabled title="No Link"><i class="fas fa-link"></i></button>`;

    let row = `<tr>
      <td>
        <div style="display: flex; gap: 5px; align-items: center;">
          ${viewResumeBtn}
          <button class="action-btn edit-btn" onclick="openEdit('${c.id}')"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete-btn" onclick="deleteCandidate('${c.id}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>`;

    fields.forEach((field) => {
      row += `<td>${c[field] || "-"}</td>`;
    });
    row += `</tr>`;
    table.innerHTML += row;
  });
}

document
  .getElementById("positionFilter")
  .addEventListener("change", applyFilters);
document.getElementById("expFilter").addEventListener("change", applyFilters);
document.getElementById("search").addEventListener("input", applyFilters);
