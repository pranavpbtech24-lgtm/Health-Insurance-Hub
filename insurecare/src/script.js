const API_BASE = "/api";

const state = {
  customers: [],
  policies: [],
  claims: [],
  documents: [],
  activities: [],
  uploadedDocIds: [],
  pendingClaimId: null
};

function $(selector) { return document.querySelector(selector); }
function $$(selector) { return document.querySelectorAll(selector); }

async function apiCall(method, endpoint, body) {
  const options = { method, headers: {} };
  if (body && !(body instanceof FormData)) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }
  console.log(`[API] ${method} ${API_BASE}${endpoint}`, body instanceof FormData ? "[FormData]" : body);
  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();
  console.log(`[API] ${method} ${API_BASE}${endpoint} →`, res.status, data);
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function formatCurrency(amount) {
  return "₹" + Number(amount).toLocaleString("en-IN");
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function init() {
  setupNavigation();
  setupMobileMenu();
  setupModal();
  setupCustomerModule();
  setupPolicyModule();
  setupClaimsModule();
  setupDocumentPreview();
  loadAllData();
}

async function loadAllData() {
  try {
    const [custData, polData, claimData, docData] = await Promise.all([
      apiCall("GET", "/customers"),
      apiCall("GET", "/policies"),
      apiCall("GET", "/claims"),
      apiCall("GET", "/documents")
    ]);
    state.customers = custData.customers || [];
    state.policies = polData.policies || [];
    state.claims = claimData.claims || [];
    state.documents = docData.documents || [];
    renderCustomersTable();
    renderPolicies();
    renderClaims();
    renderDocuments();
    updatePolicyCustomerSelect();
    updateClaimPolicySelect();
    updateDashboard();
  } catch (e) {
    showToast("error", "Could not load data", e.message);
  }
}

function setupNavigation() {
  $$(".nav-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });
}

function navigateTo(section) {
  $$(".nav-item").forEach(n => n.classList.remove("active"));
  $(`.nav-item[data-section="${section}"]`).classList.add("active");
  $$(".section").forEach(s => s.classList.remove("active"));
  $(`#section-${section}`).classList.add("active");
  if (window.innerWidth <= 768) $("#sidebar").classList.remove("open");
}

function setupMobileMenu() {
  $("#mobileMenuBtn").addEventListener("click", () => {
    $("#sidebar").classList.toggle("open");
  });
  document.addEventListener("click", (e) => {
    if (window.innerWidth <= 768 &&
        !e.target.closest(".sidebar") &&
        !e.target.closest(".mobile-menu-btn")) {
      $("#sidebar").classList.remove("open");
    }
  });
}

function showModal(title, bodyHtml) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = bodyHtml;
  $("#modal-overlay").classList.add("active");
}

function hideModal() {
  $("#modal-overlay").classList.remove("active");
}

function setupModal() {
  $("#modal-close").addEventListener("click", hideModal);
  $("#modal-overlay").addEventListener("click", (e) => {
    if (e.target === $("#modal-overlay")) hideModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { hideModal(); hidePreview(); }
  });
}

function showToast(type, message, detail) {
  const container = $("#toast-container");
  const icons = {
    success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>`,
    error: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`
  };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icons[type]}</div>
    <div class="toast-content">
      <div class="toast-message">${message}</div>
      ${detail ? `<div class="toast-detail">${detail}</div>` : ""}
    </div>
    <button class="toast-close">&times;</button>`;
  container.appendChild(toast);
  toast.querySelector(".toast-close").addEventListener("click", () => removeToast(toast));
  setTimeout(() => removeToast(toast), 4500);
}

function removeToast(toast) {
  if (!toast.parentNode) return;
  toast.classList.add("removing");
  setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
}

function addActivity(text, color) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  state.activities.unshift({ text, color, time: timeStr });
  if (state.activities.length > 20) state.activities.pop();
  renderActivities();
}

function renderActivities() {
  const list = $("#activity-list");
  if (state.activities.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        <p>No activity yet. Add customers and create policies to get started.</p>
      </div>`;
    return;
  }
  list.innerHTML = state.activities.map(a => `
    <div class="activity-item">
      <div class="activity-dot ${a.color}"></div>
      <span class="activity-text">${a.text}</span>
      <span class="activity-time">${a.time}</span>
    </div>`).join("");
}

function animateNumber(element, target, isCurrency = false) {
  const duration = 600;
  const raw = element.textContent.replace(/[^0-9]/g, "");
  const start = parseInt(raw || "0");
  const startTime = performance.now();
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (target - start) * eased);
    element.textContent = isCurrency ? formatCurrency(current) : current.toLocaleString("en-IN");
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function updateDashboard() {
  animateNumber($("#stat-customers"), state.customers.length, false);
  animateNumber($("#stat-policies"), state.policies.length, false);
  animateNumber($("#stat-approved"), state.claims.filter(c => c.status === "Approved").length, false);
  animateNumber($("#stat-pending"), state.claims.filter(c => c.status === "Pending").length, false);

  const lastCustomer = state.customers[state.customers.length - 1];
  if (lastCustomer) {
    const age = lastCustomer.age;
    let ageFactor = 1000;
    if (age < 25) ageFactor = 1000;
    else if (age <= 50) ageFactor = 2000;
    else if (age <= 75) ageFactor = 4000;
    else ageFactor = 6000;
    const diseaseFactor = lastCustomer.hasDisease ? 3000 : 0;
    $("#breakdown-age").textContent = formatCurrency(ageFactor);
    $("#breakdown-disease").textContent = formatCurrency(diseaseFactor);
    $("#breakdown-total").textContent = formatCurrency(3000 + ageFactor + diseaseFactor);
  } else {
    $("#breakdown-age").textContent = formatCurrency(0);
    $("#breakdown-disease").textContent = formatCurrency(0);
    $("#breakdown-total").textContent = formatCurrency(3000);
  }
}

function setupCustomerModule() {
  $("#addCustomerBtn").addEventListener("click", openCustomerModal);
  $("#addFirstCustomerBtn").addEventListener("click", openCustomerModal);
}

function openCustomerModal() {
  showModal("Add New Customer", `
    <div class="form-group">
      <label class="form-label">Customer Name</label>
      <input type="text" class="form-input" id="cust-name" placeholder="Enter full name" />
    </div>
    <div class="form-group">
      <label class="form-label">Age</label>
      <input type="number" class="form-input" id="cust-age" placeholder="Enter age" min="1" max="120" />
    </div>
    <div class="form-group">
      <label class="form-label">Pre-existing Disease</label>
      <div class="toggle-wrapper">
        <button class="toggle" id="cust-disease" type="button">
          <div class="toggle-knob"></div>
        </button>
        <span class="toggle-label" id="disease-label">No</span>
      </div>
    </div>
    <div class="btn-group" style="justify-content:flex-end;">
      <button class="btn btn-outline" id="modal-cancel">Cancel</button>
      <button class="btn btn-primary" id="modal-save-customer">Add Customer</button>
    </div>`);

  const toggle = $("#cust-disease");
  toggle.addEventListener("click", () => {
    toggle.classList.toggle("active");
    $("#disease-label").textContent = toggle.classList.contains("active") ? "Yes" : "No";
  });
  $("#modal-cancel").addEventListener("click", hideModal);
  $("#modal-save-customer").addEventListener("click", addCustomer);
}

async function addCustomer() {
  const name = $("#cust-name").value.trim();
  const age = parseInt($("#cust-age").value);
  const hasDisease = $("#cust-disease").classList.contains("active");

  if (!name) { showToast("error", "Name is required"); return; }
  if (!age || age < 1 || age > 120) { showToast("error", "Please enter a valid age (1–120)"); return; }

  const saveBtn = $("#modal-save-customer");
  saveBtn.disabled = true;
  saveBtn.textContent = "Adding...";

  try {
    const data = await apiCall("POST", "/addCustomer", { name, age, hasDisease });
    state.customers.push(data.customer);
    renderCustomersTable();
    updatePolicyCustomerSelect();
    updateDashboard();
    hideModal();
    showToast("success", "Customer added successfully", `${name} has been registered`);
    addActivity(`New customer "${name}" registered`, "blue");
  } catch (e) {
    showToast("error", "Failed to add customer", e.message);
    saveBtn.disabled = false;
    saveBtn.textContent = "Add Customer";
  }
}

function renderCustomersTable() {
  const tbody = $("#customers-tbody");
  const empty = $("#customers-empty");
  if (state.customers.length === 0) {
    tbody.innerHTML = "";
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  tbody.innerHTML = state.customers.map(c => `
    <tr>
      <td><span style="font-weight:600;color:var(--primary);">C-${String(c.id).padStart(3,"0")}</span></td>
      <td style="font-weight:500;color:var(--text);">${c.name}</td>
      <td>${c.age}</td>
      <td><span class="badge ${c.hasDisease ? "badge-danger" : "badge-success"}">${c.hasDisease ? "Yes" : "No"}</span></td>
      <td style="font-weight:600;">${formatCurrency(c.premium)}/yr</td>
      <td>
        <button class="action-btn delete" onclick="deleteCustomer(${c.id})" title="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
        </button>
      </td>
    </tr>`).join("");
}

window.deleteCustomer = async function(id) {
  const customer = state.customers.find(c => c.id === id);
  if (!customer) return;
  try {
    await apiCall("DELETE", `/customers/${id}`);
    state.customers = state.customers.filter(c => c.id !== id);
    renderCustomersTable();
    updatePolicyCustomerSelect();
    updateDashboard();
    showToast("info", "Customer removed", `${customer.name} has been removed`);
    addActivity(`Customer "${customer.name}" removed`, "red");
  } catch (e) {
    showToast("error", "Cannot delete customer", e.message);
  }
};

function updatePolicyCustomerSelect() {
  const select = $("#policy-customer-select");
  select.innerHTML = `<option value="">-- Select a customer --</option>`;
  state.customers.forEach(c => {
    select.innerHTML += `<option value="${c.id}">C-${String(c.id).padStart(3,"0")} - ${c.name} (Age: ${c.age})</option>`;
  });
}

function setupPolicyModule() {
  $("#createPolicyBtn").addEventListener("click", createPolicy);
  $("#calculatePremiumBtn").addEventListener("click", calculateAndShowPremium);
}

async function calculateAndShowPremium() {
  const customerId = $("#policy-customer-select").value;
  if (!customerId) { showToast("error", "Please select a customer"); return; }
  const btn = $("#calculatePremiumBtn");
  btn.disabled = true;
  btn.textContent = "Calculating...";
  try {
    const data = await apiCall("POST", "/calculatePremium", { customerId });
    const display = $("#premium-display");
    const amountEl = $("#premium-amount");
    display.classList.remove("hidden");
    animateNumber(amountEl, data.premium, true);
    showToast("info", "Premium calculated", `Annual premium: ${formatCurrency(data.premium)}`);
  } catch (e) {
    showToast("error", "Failed to calculate premium", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Calculate Premium";
  }
}

async function createPolicy() {
  const customerId = $("#policy-customer-select").value;
  if (!customerId) { showToast("error", "Please select a customer"); return; }
  const coverage = parseInt($("#coverage-amount").value);
  if (!coverage || coverage < 1000) { showToast("error", "Coverage amount must be at least ₹1,000"); return; }
  const btn = $("#createPolicyBtn");
  btn.disabled = true;
  btn.textContent = "Creating...";
  try {
    const data = await apiCall("POST", "/createPolicy", { customerId, coverageAmount: coverage });
    state.policies.push(data.policy);
    renderPolicies();
    updateClaimPolicySelect();
    updateDashboard();
    $("#coverage-amount").value = "";
    $("#policy-customer-select").value = "";
    $("#premium-display").classList.add("hidden");
    showToast("success", "Policy created successfully", `Policy P-${data.policy.id} for ${data.policy.customerName}`);
    addActivity(`Policy P-${data.policy.id} created for "${data.policy.customerName}"`, "purple");
  } catch (e) {
    showToast("error", "Failed to create policy", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Policy";
  }
}

function renderPolicies() {
  const list = $("#policies-list");
  const empty = $("#policies-empty");
  if (state.policies.length === 0) {
    list.innerHTML = "";
    list.appendChild(empty);
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  list.innerHTML = state.policies.map(p => `
    <div class="policy-card">
      <div class="policy-header">
        <span class="policy-id">P-${p.id}</span>
        <span class="badge badge-success">Active</span>
      </div>
      <div class="policy-details">
        <div class="policy-detail"><span class="policy-detail-label">Customer</span><span class="policy-detail-value">${p.customerName}</span></div>
        <div class="policy-detail"><span class="policy-detail-label">Coverage</span><span class="policy-detail-value">${formatCurrency(p.coverage)}</span></div>
        <div class="policy-detail"><span class="policy-detail-label">Premium</span><span class="policy-detail-value">${formatCurrency(p.premium)}/yr</span></div>
        <div class="policy-detail"><span class="policy-detail-label">Created</span><span class="policy-detail-value">${p.createdAt}</span></div>
      </div>
    </div>`).join("");
}

function updateClaimPolicySelect() {
  const select = $("#claim-policy-select");
  select.innerHTML = `<option value="">-- Select a policy --</option>`;
  state.policies.forEach(p => {
    select.innerHTML += `<option value="${p.id}">P-${p.id} - ${p.customerName} (Coverage: ${formatCurrency(p.coverage)})</option>`;
  });
}

function setupClaimsModule() {
  const dropZone = $("#file-drop-zone");
  const fileInput = $("#file-input");
  const pendingFiles = [];

  $("#browseFilesBtn").addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
  });
  fileInput.addEventListener("change", () => { handleFiles(fileInput.files); fileInput.value = ""; });
  $("#applyClaimBtn").addEventListener("click", applyClaim);
  $("#processClaimBtn").addEventListener("click", processClaim);
}

const pendingLocalFiles = [];

function handleFiles(fileList) {
  Array.from(fileList).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      pendingLocalFiles.push({
        id: Date.now() + Math.random(),
        file,
        name: file.name,
        size: file.size,
        ext: file.name.split(".").pop().toLowerCase(),
        type: file.type,
        dataUrl: e.target.result
      });
      renderPendingFiles();
    };
    reader.readAsDataURL(file);
  });
}

function renderPendingFiles() {
  const container = $("#uploaded-files");
  container.innerHTML = pendingLocalFiles.map((f, idx) => `
    <div class="uploaded-file">
      <div class="file-icon">${f.ext}</div>
      <div class="file-info">
        <div class="file-name">${f.name}</div>
        <div class="file-size">${formatFileSize(f.size)}</div>
      </div>
      <button class="file-remove" onclick="removePendingFile(${idx})">&times;</button>
    </div>`).join("");
}

window.removePendingFile = function(idx) {
  pendingLocalFiles.splice(idx, 1);
  renderPendingFiles();
};

async function uploadPendingFiles() {
  if (pendingLocalFiles.length === 0) return [];
  const formData = new FormData();
  pendingLocalFiles.forEach(f => formData.append("files", f.file));
  const data = await apiCall("POST", "/uploadDocument", formData);
  const uploaded = data.documents || [];
  state.documents.push(...uploaded);
  renderDocuments();
  return uploaded.map(d => d.id);
}

async function applyClaim() {
  const policyId = $("#claim-policy-select").value;
  if (!policyId) { showToast("error", "Please select a policy"); return; }
  const amount = parseInt($("#claim-amount").value);
  if (!amount || amount < 1) { showToast("error", "Please enter a valid claim amount"); return; }
  if (pendingLocalFiles.length === 0) {
    showToast("warning", "Please upload at least one document", "Hospital bills or medical reports required");
    return;
  }
  const btn = $("#applyClaimBtn");
  btn.disabled = true;
  btn.textContent = "Submitting...";
  try {
    const docIds = await uploadPendingFiles();
    const data = await apiCall("POST", "/applyClaim", { policyId, claimAmount: amount, documentIds: docIds });
    state.claims.push(data.claim);
    state.pendingClaimId = data.claim.id;
    pendingLocalFiles.length = 0;
    renderPendingFiles();
    renderClaims();
    updateDashboard();
    $("#claim-amount").value = "";
    $("#claim-policy-select").value = "";
    $("#processClaimBtn").disabled = false;
    showToast("success", "Claim submitted", `Claim CL-${data.claim.id} is pending review`);
    addActivity(`Claim CL-${data.claim.id} submitted by "${data.claim.customerName}"`, "orange");
  } catch (e) {
    showToast("error", "Failed to submit claim", e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Apply Claim";
  }
}

async function processClaim() {
  const spinner = $("#spinner-overlay");
  spinner.classList.remove("hidden");
  const btn = $("#processClaimBtn");
  btn.disabled = true;
  try {
    await new Promise(r => setTimeout(r, 1800));
    const data = await apiCall("POST", "/processClaim");
    const idx = state.claims.findIndex(c => c.id === data.claim.id);
    if (idx !== -1) state.claims[idx] = data.claim;
    renderClaims();
    updateDashboard();
    if (data.claim.status === "Approved") {
      showToast("success", "Claim Approved!", `CL-${data.claim.id}: ${formatCurrency(data.claim.amount)} approved`);
      addActivity(`Claim CL-${data.claim.id} approved (${formatCurrency(data.claim.amount)})`, "green");
    } else {
      showToast("error", "Claim Rejected", `CL-${data.claim.id}: Amount exceeds coverage by ${formatCurrency(data.claim.amount - data.claim.coverage)}`);
      addActivity(`Claim CL-${data.claim.id} rejected (exceeded coverage)`, "red");
    }
  } catch (e) {
    showToast("error", "Failed to process claim", e.message);
    btn.disabled = false;
  } finally {
    spinner.classList.add("hidden");
  }
}

function renderClaims() {
  const list = $("#claims-list");
  const empty = $("#claims-empty");
  if (state.claims.length === 0) {
    list.innerHTML = "";
    list.appendChild(empty);
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  const statusBadge = (s) => {
    const map = { Pending: "badge-warning", Approved: "badge-success", Rejected: "badge-danger" };
    return `<span class="badge ${map[s]}">${s}</span>`;
  };
  list.innerHTML = state.claims.map(c => `
    <div class="claim-card">
      <div class="claim-header">
        <span class="claim-id">CL-${c.id}</span>
        ${statusBadge(c.status)}
      </div>
      <div class="claim-details">
        <div class="claim-detail"><span class="claim-detail-label">Customer</span><span class="claim-detail-value">${c.customerName}</span></div>
        <div class="claim-detail"><span class="claim-detail-label">Claim Amount</span><span class="claim-detail-value">${formatCurrency(c.amount)}</span></div>
        <div class="claim-detail"><span class="claim-detail-label">Coverage</span><span class="claim-detail-value">${formatCurrency(c.coverage)}</span></div>
        <div class="claim-detail"><span class="claim-detail-label">Documents</span><span class="claim-detail-value">${c.documentCount} file(s)</span></div>
        <div class="claim-detail"><span class="claim-detail-label">Filed On</span><span class="claim-detail-value">${c.createdAt}</span></div>
      </div>
    </div>`).join("");
}

function renderDocuments() {
  const grid = $("#documents-grid");
  const empty = $("#documents-empty");
  if (state.documents.length === 0) {
    grid.innerHTML = "";
    grid.appendChild(empty);
    empty.style.display = "flex";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = state.documents.map(doc => {
    const ext = doc.originalName.split(".").pop().toLowerCase();
    return `
    <div class="document-card" onclick="previewDocument('${doc.id}')">
      <div class="doc-icon ${ext}">${ext}</div>
      <div class="doc-name">${doc.originalName}</div>
      <div class="doc-meta">${formatFileSize(doc.size)} ${doc.claimId ? `· Claim CL-${doc.claimId}` : ""}</div>
      <div class="doc-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); previewDocument('${doc.id}')">Preview</button>
      </div>
    </div>`;
  }).join("");
}

function setupDocumentPreview() {
  $("#preview-close").addEventListener("click", hidePreview);
  $("#preview-overlay").addEventListener("click", (e) => {
    if (e.target === $("#preview-overlay")) hidePreview();
  });
}

window.previewDocument = function(id) {
  const numId = Number(id);
  const doc = state.documents.find(d => d.id === numId);
  if (!doc) return;
  const ext = doc.originalName.split(".").pop().toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp"].includes(ext);
  $("#preview-title").textContent = doc.originalName;
  const body = $("#preview-body");
  const src = doc.path;
  if (isImage) {
    body.innerHTML = `
      <img src="${src}" alt="${doc.originalName}" style="max-width:100%;max-height:60vh;border-radius:8px;" />
      <div class="preview-info">
        <p><strong>File:</strong> ${doc.originalName}</p>
        <p><strong>Size:</strong> ${formatFileSize(doc.size)}</p>
      </div>`;
  } else if (ext === "pdf") {
    body.innerHTML = `
      <iframe src="${src}" style="width:100%;height:60vh;border:none;border-radius:8px;"></iframe>
      <div class="preview-info">
        <p><strong>File:</strong> ${doc.originalName}</p>
        <p><strong>Size:</strong> ${formatFileSize(doc.size)}</p>
      </div>`;
  } else {
    body.innerHTML = `
      <div style="padding:40px;">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" opacity="0.3" style="margin-bottom:16px;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        <p style="color:var(--text-secondary);margin-bottom:8px;"><strong>${doc.originalName}</strong></p>
        <p style="color:var(--text-muted);font-size:0.85rem;">Preview not available for this file type</p>
        <p style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">Size: ${formatFileSize(doc.size)}</p>
      </div>`;
  }
  $("#preview-overlay").classList.remove("hidden");
};

function hidePreview() {
  $("#preview-overlay").classList.add("hidden");
}

document.addEventListener("DOMContentLoaded", init);
