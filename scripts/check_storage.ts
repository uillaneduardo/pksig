import fs from "fs";
import path from "path";

async function checkStorage() {
  console.log("=== PKSIG Storage Security Verification ===");
  const storageDir = path.join(process.cwd(), "storage");
  
  if (!fs.existsSync(storageDir)) {
    console.log("Creating /storage directory...");
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const requiredSubdirs = [
    "config",
    "backups",
    "attachments",
    "attachments/thumbnail",
    "attachments/print",
    "documents"
  ];

  for (const sub of requiredSubdirs) {
    const fullPath = path.join(storageDir, sub);
    if (!fs.existsSync(fullPath)) {
      console.log(`Creating required storage subdirectory: /storage/${sub}`);
      fs.mkdirSync(fullPath, { recursive: true });
    }
  }

  // Verify gitignore entries
  const gitignorePath = path.join(process.cwd(), ".gitignore");
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");
    if (!gitignoreContent.includes("storage/*")) {
      console.error("CRITICAL ERROR: .gitignore does NOT contain 'storage/*' rule!");
      process.exit(1);
    }
  } else {
    console.error("CRITICAL ERROR: .gitignore file not found!");
    process.exit(1);
  }

  console.log("SUCCESS: Storage directories verified and properly protected.");
}

checkStorage().catch((err) => {
  console.error("Storage check failed:", err);
  process.exit(1);
});
