import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = Router();

interface Customer {
  id: number;
  name: string;
  age: number;
  hasDisease: boolean;
  premium: number;
}

interface Policy {
  id: number;
  customerId: number;
  customerName: string;
  coverage: number;
  premium: number;
  status: string;
  createdAt: string;
}

interface Claim {
  id: number;
  policyId: number;
  customerName: string;
  amount: number;
  coverage: number;
  status: string;
  documentCount: number;
  createdAt: string;
}

interface Document {
  id: number;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  claimId: number | null;
  uploadedAt: string;
}

const customers: Customer[] = [];
const policies: Policy[] = [];
const claims: Claim[] = [];
const documents: Document[] = [];

let customerIdCounter = 1;
let policyIdCounter = 101;
let claimIdCounter = 201;
let documentIdCounter = 1;
let pendingClaimId: number | null = null;

const uploadsDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/jpg", "image/png", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, and PNG files are accepted"));
    }
  }
});

function getAgeFactor(age: number): number {
  if (age < 25) return 1000;
  if (age <= 50) return 2000;
  if (age <= 75) return 4000;
  return 6000;
}

function calculatePremium(age: number, hasDisease: boolean): number {
  const base = 3000;
  const ageFactor = getAgeFactor(age);
  const diseaseFactor = hasDisease ? 3000 : 0;
  return base + ageFactor + diseaseFactor;
}

router.get("/customers", (_req, res) => {
  res.json({ customers });
});

router.post("/addCustomer", (req, res) => {
  const { name, age, hasDisease } = req.body;
  console.log("[addCustomer] body:", req.body);
  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ error: "Name is required" });
  }
  const parsedAge = parseInt(age);
  if (isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120) {
    return res.status(400).json({ error: "Valid age between 1 and 120 is required" });
  }
  const disease = hasDisease === true || hasDisease === "true";
  const customer: Customer = {
    id: customerIdCounter++,
    name: name.trim(),
    age: parsedAge,
    hasDisease: disease,
    premium: calculatePremium(parsedAge, disease)
  };
  customers.push(customer);
  console.log("[addCustomer] created:", customer);
  res.json({ success: true, customer });
});

router.delete("/customers/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const idx = customers.findIndex(c => c.id === id);
  if (idx === -1) return res.status(404).json({ error: "Customer not found" });
  const hasPolicies = policies.some(p => p.customerId === id);
  if (hasPolicies) return res.status(400).json({ error: "Customer has active policies" });
  const [removed] = customers.splice(idx, 1);
  res.json({ success: true, customer: removed });
});

router.get("/policies", (_req, res) => {
  res.json({ policies });
});

router.post("/createPolicy", (req, res) => {
  const { customerId, coverageAmount } = req.body;
  const parsedCustomerId = parseInt(customerId);
  const customer = customers.find(c => c.id === parsedCustomerId);
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const coverage = parseInt(coverageAmount);
  if (isNaN(coverage) || coverage < 1000) {
    return res.status(400).json({ error: "Coverage must be at least ₹1,000" });
  }
  const existing = policies.find(p => p.customerId === parsedCustomerId);
  if (existing) return res.status(400).json({ error: `Policy P-${existing.id} already exists for this customer` });
  const policy: Policy = {
    id: policyIdCounter++,
    customerId: parsedCustomerId,
    customerName: customer.name,
    coverage,
    premium: customer.premium,
    status: "Active",
    createdAt: new Date().toLocaleDateString("en-IN")
  };
  policies.push(policy);
  res.json({ success: true, policy });
});

router.post("/calculatePremium", (req, res) => {
  const { customerId } = req.body;
  console.log("[calculatePremium] body:", req.body);
  if (!customerId) return res.status(400).json({ error: "customerId is required" });
  const customer = customers.find(c => c.id === parseInt(customerId));
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  const ageFactor = getAgeFactor(customer.age);
  const diseaseFactor = customer.hasDisease ? 3000 : 0;
  const premium = 3000 + ageFactor + diseaseFactor;
  console.log("[calculatePremium] result:", { customer: customer.name, age: customer.age, ageFactor, diseaseFactor, premium });
  res.json({ success: true, premium, base: 3000, ageFactor, diseaseFactor });
});

router.get("/claims", (_req, res) => {
  res.json({ claims });
});

router.post("/applyClaim", (req, res) => {
  const { policyId, claimAmount, documentIds } = req.body;
  console.log("[applyClaim] body:", req.body);
  if (!policyId) return res.status(400).json({ error: "policyId is required" });
  if (!claimAmount) return res.status(400).json({ error: "claimAmount is required" });
  const policy = policies.find(p => p.id === parseInt(policyId));
  if (!policy) return res.status(404).json({ error: "Policy not found" });
  const amount = parseInt(claimAmount);
  if (isNaN(amount) || amount < 1) return res.status(400).json({ error: "Claim amount must be a positive number" });
  const claim: Claim = {
    id: claimIdCounter++,
    policyId: policy.id,
    customerName: policy.customerName,
    amount,
    coverage: policy.coverage,
    status: "Pending",
    documentCount: Array.isArray(documentIds) ? documentIds.length : 0,
    createdAt: new Date().toLocaleDateString("en-IN")
  };
  claims.push(claim);
  pendingClaimId = claim.id;
  if (Array.isArray(documentIds)) {
    documentIds.forEach((docId: number) => {
      const doc = documents.find(d => d.id === docId);
      if (doc) doc.claimId = claim.id;
    });
  }
  res.json({ success: true, claim });
});

router.post("/processClaim", (_req, res) => {
  console.log("[processClaim] pendingClaimId:", pendingClaimId);
  if (pendingClaimId === null) return res.status(400).json({ error: "No pending claim to process" });
  const claim = claims.find(c => c.id === pendingClaimId);
  if (!claim || claim.status !== "Pending") return res.status(400).json({ error: "No pending claim found" });
  if (claim.amount <= claim.coverage) {
    claim.status = "Approved";
  } else {
    claim.status = "Rejected";
  }
  console.log("[processClaim] result:", { id: claim.id, amount: claim.amount, coverage: claim.coverage, status: claim.status });
  pendingClaimId = null;
  res.json({ success: true, claim });
});

router.get("/documents", (_req, res) => {
  res.json({ documents });
});

router.post("/uploadDocument", upload.array("files", 10), (req, res) => {
  const files = req.files as Express.Multer.File[];
  if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });
  const uploaded: Document[] = files.map(f => ({
    id: documentIdCounter++,
    filename: f.filename,
    originalName: f.originalname,
    mimetype: f.mimetype,
    size: f.size,
    path: `/api/uploads/${f.filename}`,
    claimId: null,
    uploadedAt: new Date().toLocaleDateString("en-IN")
  }));
  documents.push(...uploaded);
  res.json({ success: true, documents: uploaded });
});

export default router;
