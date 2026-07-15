// Local dev server. NOT used on Vercel (Vercel serves the static files at the
// project root and runs api/data.js as a serverless function automatically).
// Here we serve the static files and reuse the SAME api/data.js handler so the
// local behaviour matches production exactly.

import http from "node:http"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import dataHandler from "./api/data.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
}

function enhanceRes(res) {
  res.status = (code) => {
    res.statusCode = code
    return res
  }
  res.json = (obj) => {
    res.setHeader("Content-Type", "application/json; charset=utf-8")
    res.end(JSON.stringify(obj))
    return res
  }
  return res
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ""
    req.on("data", (c) => (raw += c))
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        resolve({})
      }
    })
  })
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)

  // API
  if (url.pathname.startsWith("/api/data")) {
    enhanceRes(res)
    if (req.method === "POST") req.body = await readBody(req)
    try {
      await dataHandler(req, res)
    } catch (e) {
      if (!res.writableEnded) res.status(500).json({ error: "server error" })
    }
    return
  }

  // Static files
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname
  filePath = path.join(__dirname, decodeURIComponent(filePath))

  // prevent path traversal
  if (!filePath.startsWith(__dirname)) {
    res.statusCode = 403
    res.end("Forbidden")
    return
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.statusCode = 404
      res.setHeader("Content-Type", "text/html; charset=utf-8")
      res.end("<h1>404 Not Found</h1>")
      return
    }
    res.statusCode = 200
    res.setHeader("Content-Type", MIME[path.extname(filePath)] || "application/octet-stream")
    res.end(content)
  })
})

server.listen(PORT, () => {
  console.log(`[v0] dev server running on http://localhost:${PORT}`)
})
