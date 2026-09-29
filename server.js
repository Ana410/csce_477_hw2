const crypto = require("crypto");
const http = require("http");
const fs = require("fs");
const path = require("path");
const querystring = require("querystring");
const { DatabaseSync } = require("node:sqlite");

const PORT = process.env.PORT || 3000;
const indexPath = path.join(__dirname, "public", "index.html");
const dataDirectory = path.join(__dirname, "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const database = new DatabaseSync(path.join(dataDirectory, "users.db"));
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

function validateCredentials(email, password) {
  const errors = [];

  if (!email || !password) {
    errors.push("Email and password are required.");
  } else {
    if (!email.includes("@")) {
      errors.push("Email must contain '@'.");
    }

    if (password.length < 8) {
      errors.push("Password must be at least 8 characters.");
    }
  }

  return errors;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function passwordMatches(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(":");
  const actualHash = crypto.scryptSync(password, salt, 64);
  const expectedHashBuffer = Buffer.from(expectedHash, "hex");
  return (
    expectedHashBuffer.length === actualHash.length &&
    crypto.timingSafeEqual(actualHash, expectedHashBuffer)
  );
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10_000) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(querystring.parse(body)));
    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

const server = http.createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/") {
    fs.readFile(indexPath, (error, contents) => {
      if (error) {
        response.writeHead(500, { "Content-Type": "text/plain" });
        response.end("Unable to load the login page.");
        return;
      }

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(contents);
    });
    return;
  }

  if (
    request.method === "POST" &&
    (request.url === "/login" || request.url === "/create-account")
  ) {
    try {
      const body = await readRequestBody(request);
      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const errors = validateCredentials(email, password);

      if (errors.length) {
        sendJson(response, 400, { success: false, errors });
        return;
      }

      if (request.url === "/create-account") {
        try {
          database
            .prepare(
              "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            )
            .run(email, hashPassword(password));
        } catch (error) {
          if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
            sendJson(response, 409, {
              success: false,
              errors: ["An account with that email already exists."],
            });
            return;
          }
          throw error;
        }

        sendJson(response, 201, {
          success: true,
          message: "Account created successfully. You can now log in.",
        });
        return;
      }

      const user = database
        .prepare("SELECT password_hash FROM users WHERE email = ?")
        .get(email);

      if (!user || !passwordMatches(password, user.password_hash)) {
        sendJson(response, 401, {
          success: false,
          errors: ["Invalid email or password."],
        });
        return;
      }

      sendJson(response, 200, {
        success: true,
        message: "Login successful.",
      });
    } catch (error) {
      console.error("Request error:", error);
      sendJson(response, 500, {
        success: false,
        errors: ["Unable to process the request."],
      });
    }
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain" });
  response.end("Not found.");
});

server.listen(PORT, () => {
  console.log(`Login page available at http://localhost:${PORT}`);
});
