#!/usr/bin/env node
/**
 * 将已打好的源码 ZIP 放到服务端下载目录，并生成 2 小时有效的随机令牌。
 * 不把令牌写入仓库。
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "fs";
import { createHash, randomBytes } from "crypto";

const SRC = "/opt/cursor/artifacts/cnooc-eng-supervision-demo-v1.6.1-src.zip";
const DIR = "/tmp/cnooc-src-export";
const DEST = `${DIR}/cnooc-eng-supervision-demo-v1.6.1-src.zip`;
const META = `${DIR}/meta.json`;
const TTL_MS = 2 * 60 * 60 * 1000;

if (!existsSync(SRC)) {
  console.error("找不到已生成的源码包:", SRC);
  process.exit(1);
}

mkdirSync(DIR, { recursive: true });
copyFileSync(SRC, DEST);
const buf = readFileSync(DEST);
const token = randomBytes(32).toString("hex");
const expiresAtMs = Date.now() + TTL_MS;
const meta = {
  token,
  expiresAtMs,
  expiresAtIso: new Date(expiresAtMs).toISOString(),
  filename: "cnooc-eng-supervision-demo-v1.6.1-src.zip",
  filePath: DEST,
  bytes: statSync(DEST).size,
  sha256: createHash("sha256").update(buf).digest("hex"),
};
writeFileSync(META, JSON.stringify(meta, null, 2));
writeFileSync(
  `${DIR}/public-link.txt`,
  [
    `token=${token}`,
    `expiresAtIso=${meta.expiresAtIso}`,
    `sha256=${meta.sha256}`,
    `bytes=${meta.bytes}`,
  ].join("\n") + "\n",
);
console.log(JSON.stringify({ expiresAtIso: meta.expiresAtIso, sha256: meta.sha256, bytes: meta.bytes, token }, null, 2));
