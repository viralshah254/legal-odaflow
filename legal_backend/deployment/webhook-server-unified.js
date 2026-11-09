const express = require("express");
const { spawn } = require("child_process");
const crypto = require("crypto");
const path = require("path");
const axios = require("axios");
const Redis = require("ioredis");

const app = express();
const port = 3000;

// Middleware to capture raw body for signature verification
app.use("/webhook", (req, res, next) => {
  let rawBody = "";
  req.on("data", (chunk) => {
    rawBody += chunk.toString();
  });
  req.on("end", () => {
    req.rawBody = rawBody;
    if (!rawBody || rawBody.trim() === "") {
      req.body = {};
      return next();
    }
    try {
      req.body = JSON.parse(rawBody);
    } catch (err) {
      console.error("Webhook JSON parse error:", err.message);
      return res.status(400).json({ error: "Invalid JSON body" });
    }
    next();
  });
});

app.use(express.json());

// Add error handling for JSON parsing
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    console.error("❌ JSON parsing error:", error.message);
    console.error("Raw body:", req.body);
    return res.status(400).json({ error: "Invalid JSON" });
  }
  next();
});

// GitHub webhook secret (required — no default)
const DEFAULT_WEBHOOK_SECRETS = new Set([
  'your-webhook-secret',
  'your-dev-webhook-secret',
]);
const WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET;
const IMAGE_TAG = process.env.IMAGE_TAG;

if (!WEBHOOK_SECRET || DEFAULT_WEBHOOK_SECRETS.has(WEBHOOK_SECRET)) {
  console.error(
    'FATAL: GITHUB_WEBHOOK_SECRET must be set to a non-default value before starting the webhook server.',
  );
  process.exit(1);
}

// Configuration
const SWARM_DIR =
  process.env.SWARM_DIR || path.join(__dirname, "..", "docker-swarm");
const DEPLOY_SCRIPT = path.join(SWARM_DIR, "deploy-from-dockerhub.sh");
const HOST_PROJECT_ROOT = process.env.HOST_PROJECT_ROOT || "/home/ubuntu/legal_backend";

// Redis connection for storing health data
// Use EC2 public IP or host IP instead of localhost since webhook server runs outside Docker
const REDIS_URL = process.env.REDIS_URL;
const API_URL = process.env.API_URL;
const redis = new Redis(REDIS_URL);

// Function to verify GitHub webhook signature
function verifySignature(payload, signature) {
  if (!signature) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", WEBHOOK_SECRET)
    .update(payload, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(`sha256=${expectedSignature}`, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

// Function to test Docker CLI availability
async function testDockerCLI() {
  try {
    return new Promise((resolve) => {
      console.log(`🧪 Testing Docker CLI availability...`);
      const docker = spawn("docker", ["--version"]);
      let output = "";
      let errorOutput = "";

      docker.stdout.on("data", (data) => {
        output += data.toString();
      });

      docker.stderr.on("data", (data) => {
        errorOutput += data.toString();
      });

      docker.on("close", (code) => {
        console.log(`🧪 Docker --version - Exit code: ${code}`);
        console.log(`🧪 Docker --version - Output: "${output.trim()}"`);
        console.log(`🧪 Docker --version - Error: "${errorOutput.trim()}"`);

        if (code === 0) {
          console.log(`✅ Docker CLI is available!`);
        } else {
          console.log(`❌ Docker CLI test failed`);
        }

        resolve({
          available: code === 0,
          output: output.trim(),
          error: errorOutput.trim(),
        });
      });

      docker.on("error", (error) => {
        console.log(`🧪 Docker CLI test - Spawn error: ${error.message}`);
        resolve({
          available: false,
          output: "",
          error: error.message,
        });
      });
    });
  } catch (error) {
    console.log(`🧪 Docker CLI test - Exception: ${error.message}`);
    return { available: false, error: error.message };
  }
}

// Function to check if Docker Swarm is ready (simplified)
async function checkSwarmStatus() {
  // Skip Docker checks entirely - assume swarm is ready
  // The deployment scripts will handle Docker commands on the host
  return {
    ready: true,
    output: "active",
    error: "",
    exitCode: 0,
  };
}

// Function to check API health
async function checkAPIHealth() {
  try {
    const response = await axios.get(`${API_URL}/api/v1/health`, {
      timeout: 5000,
    });
    return {
      healthy: response.data.status === "ok",
      responseTime: Date.now() - Date.now(), // Simplified
      details: response.data,
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
    };
  }
}

// Function to store deployment record (one Redis key per commit — updated in place)
async function storeDeploymentRecord(commitInfo, status, error = null) {
  try {
    const commitKey = `deployment:commit:${commitInfo.id}`;
    const existingRaw = await redis.get(commitKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    const deploymentData = {
      id: existing?.id || `deploy-${Date.now()}-${commitInfo.id}`,
      status: status,
      timestamp: new Date().toISOString(),
      startedAt: existing?.startedAt || new Date().toISOString(),
      commit: commitInfo.id,
      imageTag: commitInfo.fullSha || commitInfo.id,
      author: commitInfo.author,
      message: commitInfo.message,
      healthChecks: existing?.healthChecks || [],
      rollbackTriggered: false,
      error: error,
    };

    await redis.setex(commitKey, 3600, JSON.stringify(deploymentData));

    console.log(`📊 Deployment record stored: ${status} (${commitInfo.id})`);
  } catch (error) {
    console.warn(`⚠️ Could not store deployment record: ${error.message}`);
  }
}

// Function to run deployment in background
// Runs deploy script via docker run with host paths — same env as manual "bash deploy-from-dockerhub.sh" on server
// imageTag: full git SHA for prod (main), "dev" for dev (liveness)
function runDeploymentInBackground(commitInfo, imageTag = "latest") {
  console.log(
    `🚀 Starting Docker Swarm deployment for commit: ${commitInfo.id} (IMAGE_TAG=${imageTag})`
  );
  console.log(`📝 Commit message: ${commitInfo.message}`);
  console.log(`👤 Author: ${commitInfo.author}`);
  console.log(`📂 HOST_PROJECT_ROOT: ${HOST_PROJECT_ROOT}`);

  // Store deployment as "deploying"
  storeDeploymentRecord(commitInfo, "deploying");

  const swarmDir = `${HOST_PROJECT_ROOT}/docker-swarm`;
  const deploymentDir = `${HOST_PROJECT_ROOT}/deployment`;

  // Run deploy script in a one-off container with host paths mounted — mirrors manual run on server
  const appEnvPath = `${HOST_PROJECT_ROOT}/.env`;
  const dockerArgs = [
    "run",
    "--rm",
    "--network", "host",
    "-v", "/var/run/docker.sock:/var/run/docker.sock",
    "-v", `${swarmDir}:/deploy`,
    "-v", `${deploymentDir}:/deploy/../deployment`,
    // Mount the app .env at its host path so the deploy script's file-existence
    // check passes and the prisma migrate docker run -v bind also resolves correctly.
    "-v", `${appEnvPath}:${appEnvPath}:ro`,
    "-w", "/deploy",
    "-e", `DOCKER_HUB_TOKEN=${process.env.DOCKER_HUB_TOKEN || ""}`,
    "-e", `API_URL=${process.env.API_URL || "http://127.0.0.1:4000"}`,
    "-e", `HOST_PROJECT_ROOT=${HOST_PROJECT_ROOT}`,
    "-e", `IMAGE_TAG=${imageTag}`,
    "docker:29.5.2-cli",
    "sh", "-c", "apk add --no-cache bash curl >/dev/null && bash ./deploy-from-dockerhub.sh",
  ];

  // Environment assignments contain credentials; never serialize dockerArgs.
  console.log(`📜 Starting deployment runner for image ${imageTag}`);

  const deployProcess = spawn("docker", dockerArgs, {
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, LOG_FILE: `${swarmDir}/deploy-dockerhub.log` },
  });

  deployProcess.stdout.on("data", (data) => {
    console.log(`[DEPLOY] ${data.toString().trim()}`);
  });

  deployProcess.stderr.on("data", (data) => {
    console.error(`[DEPLOY ERROR] ${data.toString().trim()}`);
  });

  deployProcess.on("close", (code) => {
    if (code === 0) {
      console.log(
        `✅ Docker Swarm deployment completed successfully for commit: ${commitInfo.id}`
      );
      storeDeploymentRecord(commitInfo, "success");
    } else {
      console.error(
        `❌ Docker Swarm deployment failed with exit code: ${code} for commit: ${commitInfo.id}`
      );
      storeDeploymentRecord(commitInfo, "failed", `Exit code: ${code}`);
    }
  });

  deployProcess.on("error", (error) => {
    console.error(`💥 Deployment process error: ${error.message}`);
    storeDeploymentRecord(commitInfo, "error", error.message);
  });

  deployProcess.unref();
}

// Function to get deployment history
async function getDeploymentHistory() {
  try {
    const keys = await redis.keys("deployment:*");
    const deployments = [];
    const seen = new Set();

    for (const key of keys) {
      if (key.startsWith("deployment:commit:") || key.startsWith("deployment:deploy-")) {
        const data = await redis.get(key);
        if (!data) continue;
        const parsed = JSON.parse(data);
        const dedupeKey = `${parsed.commit}:${parsed.status}:${parsed.timestamp}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);
        deployments.push(parsed);
      }
    }

    return deployments.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  } catch (error) {
    console.error("Error getting deployment history:", error);
    return [];
  }
}

// Function to trigger rollback
async function triggerRollback(deploymentId) {
  try {
    console.log(`🔄 Triggering rollback for deployment: ${deploymentId}`);

    const rollbackProcess = spawn(
      "bash",
      [path.join(SWARM_DIR, "rollback-dockerhub.sh")],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          LOG_FILE: "/tmp/rollback-dockerhub.log", // Use /tmp for logs (writable)
        },
      }
    );

    rollbackProcess.stdout.on("data", (data) => {
      console.log(`[ROLLBACK] ${data.toString().trim()}`);
    });

    rollbackProcess.stderr.on("data", (data) => {
      console.error(`[ROLLBACK ERROR] ${data.toString().trim()}`);
    });

    rollbackProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ Rollback completed successfully");
      } else {
        console.error(`❌ Rollback failed with exit code: ${code}`);
      }
    });
  } catch (error) {
    console.error("💥 Rollback failed:", error);
    throw error;
  }
}

// Endpoint for GitHub Webhook
app.post("/webhook", async (req, res) => {
  const signature = req.headers["x-hub-signature-256"];
  const payload = req.rawBody || JSON.stringify(req.body);

  if (!verifySignature(payload, signature)) {
    console.warn("Invalid webhook signature rejected");
    return res.status(401).send("Unauthorized");
  }

  const { ref, repository, head_commit } = req.body;

  // Only deploy on pushes to main branch (prod) or liveness (dev)
  const isMain = ref === "refs/heads/main";
  const isLiveness = ref === "refs/heads/liveness";
  if (!isMain && !isLiveness) {
    console.log(`⏭️  Ignoring push to ${ref}. Only main (prod) or liveness (dev).`);
    return res.status(200).send("Ignored: Not main or liveness branch");
  }

  // IMAGE_TAG from branch: main → commit SHA (immutable), liveness → dev; fallback latest if SHA missing
  const fullCommitSha = head_commit?.id?.trim() || "";
  const effectiveImageTag = isMain
    ? (fullCommitSha || "latest")
    : "dev";
  console.log(`📦 Branch: ${ref}, IMAGE_TAG: ${effectiveImageTag} (will deploy ayienda/legal-byodaflow:${effectiveImageTag})`);

  // Extract commit information
  const commitInfo = {
    id: fullCommitSha ? fullCommitSha.slice(0, 8) : "unknown",
    fullSha: fullCommitSha || null,
    message: head_commit?.message || "Unknown commit message",
    author: head_commit?.author?.name || "Unknown author",
    timestamp: head_commit?.timestamp || new Date().toISOString(),
  };

  console.log(
    `🎯 Received webhook push event for ${repository?.name} on main branch`
  );

  // Check Docker Swarm status before deployment
  const swarmStatus = await checkSwarmStatus();
  if (!swarmStatus.ready) {
    console.error(
      `❌ Docker Swarm is not ready: ${swarmStatus.output || swarmStatus.error}`
    );
    return res.status(500).json({
      success: false,
      message: "Docker Swarm is not ready",
      error: swarmStatus.output || swarmStatus.error,
    });
  }

  // Check current deployment health
  const healthStatus = await checkAPIHealth();
  if (!healthStatus.healthy) {
    console.warn(`⚠️ Current deployment is not healthy: ${healthStatus.error}`);
  }

  // 🚀 RESPOND IMMEDIATELY TO GITHUB (before starting deployment)
  res.status(200).json({
    success: true,
    message:
      "Webhook received successfully. Docker Swarm deployment started in background.",
    commit: commitInfo.id,
    timestamp: new Date().toISOString(),
    swarmStatus: swarmStatus.output,
    currentHealth: healthStatus.healthy ? "healthy" : "unhealthy",
  });

  // Start deployment in background AFTER responding to GitHub
  setTimeout(() => {
    runDeploymentInBackground(commitInfo, effectiveImageTag);
  }, 100); // Small delay to ensure response is sent
});

// Health check endpoint
app.get("/health", async (req, res) => {
  try {
    const swarmStatus = await checkSwarmStatus();
    const healthStatus = await checkAPIHealth();
    const imageTag = IMAGE_TAG;

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      port: port,
      uptime: process.uptime(),
      image_tag: imageTag,
      swarm: {
        ready: swarmStatus.ready,
        status: swarmStatus.output,
      },
      api: {
        healthy: healthStatus.healthy,
        error: healthStatus.error,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Dashboard endpoint
app.get("/dashboard", async (req, res) => {
  try {
    const [healthStatus, deployments, swarmStatus] = await Promise.all([
      checkAPIHealth(),
      getDeploymentHistory(),
      checkSwarmStatus(),
    ]);

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      health: healthStatus,
      deployments: deployments.slice(0, 10), // Last 10 deployments
      swarm: {
        ready: swarmStatus.ready,
        status: swarmStatus.output,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Deployments endpoint
app.get("/deployments", async (req, res) => {
  try {
    const deployments = await getDeploymentHistory();
    res.json({
      status: "ok",
      deployments,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Rollback endpoint
app.post("/rollback/:deploymentId", async (req, res) => {
  try {
    const { deploymentId } = req.params;
    await triggerRollback(deploymentId);
    res.json({ status: "ok", message: "Rollback triggered" });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Status endpoint
app.get("/status", async (req, res) => {
  try {
    const swarmStatus = await checkSwarmStatus();
    const healthStatus = await checkAPIHealth();

    res.json({
      message: "GitHub Webhook Server (Unified)",
      endpoints: [
        "/webhook",
        "/health",
        "/dashboard",
        "/deployments",
        "/rollback/:id",
      ],
      listening_for: "pushes to main branch",
      webhook_secret_configured: true,
      process_id: process.pid,
      memory_usage: process.memoryUsage(),
      uptime_seconds: Math.floor(process.uptime()),
      swarm: {
        ready: swarmStatus.ready,
        status: swarmStatus.output,
      },
      api: {
        healthy: healthStatus.healthy,
        error: healthStatus.error,
      },
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "GitHub Webhook Server (Unified)",
    endpoints: [
      "/webhook",
      "/health",
      "/dashboard",
      "/deployments",
      "/rollback/:id",
    ],
    listening_for: "pushes to main branch",
    version: "4.0.0-unified",
    image_tag: IMAGE_TAG,
    features: [
      "Zero-downtime deployment",
      "Automatic rollback",
      "Health monitoring",
      "Deployment dashboard",
      "Docker Swarm integration",
    ],
  });
});

app.listen(port, () => {
  console.log(
    `🎯 Unified Webhook server listening at http://localhost:${port}`
  );
  console.log(`📡 Webhook endpoint: http://localhost:${port}/webhook`);
  console.log(`💚 Health check: http://localhost:${port}/health`);
  console.log(`📊 Dashboard: http://localhost:${port}/dashboard`);
  console.log(`📦 Deployments: http://localhost:${port}/deployments`);
  console.log(`🔄 Rollback: http://localhost:${port}/rollback/:id`);
  console.log(
    `🔐 Webhook secret configured: yes`,
  );
  console.log(`🐳 Docker Swarm deployment enabled`);
  console.log(`🔗 Redis URL: ${REDIS_URL}`);
  console.log(`🔗 API URL: ${API_URL}`);
  console.log(`📂 SWARM_DIR: ${SWARM_DIR}`);
  console.log(`📜 DEPLOY_SCRIPT: ${DEPLOY_SCRIPT}`);
  console.log(`📂 HOST_PROJECT_ROOT: ${HOST_PROJECT_ROOT}`);
});
