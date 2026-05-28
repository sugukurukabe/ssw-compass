/**
 * SSW Compass Pro tier JWT 発行スクリプト (ADR-013 / GAT-44)
 * SSW Compass Pro tier JWT issuance script (ADR-013 / GAT-44)
 * Skrip penerbitan JWT tier Pro SSW Compass (ADR-013 / GAT-44)
 */

import { execFile } from "node:child_process";
import { createHmac } from "node:crypto";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type IssueJwtTier = "free" | "pro" | "business";
export type IssueJwtAuthSource = "jwt" | "oauth_client_credentials";

export interface IssueJwtOptions {
  sub: string;
  tier: IssueJwtTier;
  gyoseishoshiVerified: boolean;
  gyoseishoshiNumber?: string;
  expires: string;
  project: string;
  secret: string;
  secretVersion: string;
  authSource: IssueJwtAuthSource;
}

export interface IssueJwtClaims {
  sub: string;
  tier: IssueJwtTier;
  gyoseishoshi_verified: boolean;
  auth_source: IssueJwtAuthSource;
  iat: number;
  exp: number;
  gyoseishoshi_number?: string;
}

const DEFAULT_PROJECT = "ssw-compass-prod-494613";
const DEFAULT_SECRET = "ssw-jwt-secret";
const DEFAULT_SECRET_VERSION = "latest";
const DEFAULT_EXPIRES = "90d";

const USAGE = `Usage:
  pnpm tsx scripts/issue-jwt.ts --sub <id> --tier pro --gyoseishoshi-verified --expires 90d [options]

Options:
  --sub <id>                         JWT subject / AuthContext user_id
  --tier <free|pro|business>         Subscription tier (default: pro)
  --gyoseishoshi-verified            Mark the user as verified for L2 tools
  --gyoseishoshi-number <value>      Registration number, e.g. "東京都 12345"
  --expires <duration>               Duration: 90d, 24h, 30m, 60s (default: 90d)
  --project <project-id>             Secret Manager project (default: ssw-compass-prod-494613)
  --secret <secret-id>               Secret Manager secret id (default: ssw-jwt-secret)
  --secret-version <version>         Secret version (default: latest)
  --auth-source <jwt|oauth_client_credentials>
  --help
`;

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
}

function parseTier(value: string): IssueJwtTier {
  if (value === "free" || value === "pro" || value === "business") return value;
  throw new Error(`Invalid --tier value: ${value}`);
}

function parseAuthSource(value: string): IssueJwtAuthSource {
  if (value === "jwt" || value === "oauth_client_credentials") return value;
  throw new Error(`Invalid --auth-source value: ${value}`);
}

export function parseDurationSeconds(duration: string): number {
  const match = /^(\d+)([smhd])$/.exec(duration);
  if (match === null) {
    throw new Error(`Invalid duration: ${duration}. Use formats like 90d, 24h, 30m, 60s.`);
  }

  const amountText = match[1];
  const unit = match[2];
  if (amountText === undefined || (unit !== "s" && unit !== "m" && unit !== "h" && unit !== "d")) {
    throw new Error(`Invalid duration: ${duration}. Use formats like 90d, 24h, 30m, 60s.`);
  }
  const amount = Number.parseInt(amountText, 10);
  if (amount <= 0) {
    throw new Error(`Duration must be positive: ${duration}`);
  }

  switch (unit) {
    case "s":
      return amount;
    case "m":
      return amount * 60;
    case "h":
      return amount * 60 * 60;
    case "d":
      return amount * 24 * 60 * 60;
  }
}

export function parseIssueJwtArgs(args: string[]): IssueJwtOptions {
  const options: IssueJwtOptions = {
    sub: "",
    tier: "pro",
    gyoseishoshiVerified: false,
    expires: DEFAULT_EXPIRES,
    project: DEFAULT_PROJECT,
    secret: DEFAULT_SECRET,
    secretVersion: DEFAULT_SECRET_VERSION,
    authSource: "jwt",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    switch (arg) {
      case "--help":
        process.stdout.write(USAGE);
        process.exit(0);
        return options;
      case "--sub":
        options.sub = requireValue(args, i, arg);
        i += 1;
        break;
      case "--tier":
        options.tier = parseTier(requireValue(args, i, arg));
        i += 1;
        break;
      case "--gyoseishoshi-verified":
        options.gyoseishoshiVerified = true;
        break;
      case "--gyoseishoshi-number":
        options.gyoseishoshiNumber = requireValue(args, i, arg);
        i += 1;
        break;
      case "--expires":
        options.expires = requireValue(args, i, arg);
        i += 1;
        break;
      case "--project":
        options.project = requireValue(args, i, arg);
        i += 1;
        break;
      case "--secret":
        options.secret = requireValue(args, i, arg);
        i += 1;
        break;
      case "--secret-version":
        options.secretVersion = requireValue(args, i, arg);
        i += 1;
        break;
      case "--auth-source":
        options.authSource = parseAuthSource(requireValue(args, i, arg));
        i += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg ?? ""}`);
    }
  }

  if (options.sub.trim().length === 0) {
    throw new Error("--sub is required.");
  }

  if (
    options.gyoseishoshiNumber !== undefined &&
    !/^[\u4e00-\u9fa5]+ \d+$/.test(options.gyoseishoshiNumber)
  ) {
    throw new Error('--gyoseishoshi-number must match the format "東京都 12345".');
  }

  return options;
}

export function buildJwtClaims(options: IssueJwtOptions, nowSeconds: number): IssueJwtClaims {
  const claims: IssueJwtClaims = {
    sub: options.sub,
    tier: options.tier,
    gyoseishoshi_verified: options.gyoseishoshiVerified,
    auth_source: options.authSource,
    iat: nowSeconds,
    exp: nowSeconds + parseDurationSeconds(options.expires),
  };

  if (options.gyoseishoshiNumber !== undefined) {
    claims.gyoseishoshi_number = options.gyoseishoshiNumber;
  }

  return claims;
}

function base64UrlEncodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function signHs256Jwt(claims: IssueJwtClaims, secret: string): string {
  const header = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
  const payload = base64UrlEncodeJson(claims);
  const signature = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export async function getJwtSecret(
  options: Pick<IssueJwtOptions, "project" | "secret" | "secretVersion">,
): Promise<string> {
  const { stdout } = await execFileAsync("gcloud", [
    "secrets",
    "versions",
    "access",
    options.secretVersion,
    "--secret",
    options.secret,
    "--project",
    options.project,
  ]);
  const secret = stdout.trimEnd();
  if (secret.length === 0) {
    throw new Error(
      `Secret Manager returned an empty secret: ${options.project}/${options.secret}`,
    );
  }
  return secret;
}

export async function issueJwt(
  options: IssueJwtOptions,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<string> {
  const secret = await getJwtSecret(options);
  return signHs256Jwt(buildJwtClaims(options, nowSeconds), secret);
}

async function main(): Promise<void> {
  try {
    const options = parseIssueJwtArgs(process.argv.slice(2));
    const token = await issueJwt(options);
    process.stdout.write(`${token}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${basename(process.argv[1] ?? "issue-jwt.ts")}: ${message}\n\n${USAGE}`);
    process.exitCode = 1;
  }
}

const entrypoint = process.argv[1] === undefined ? "" : pathToFileURL(process.argv[1]).href;
if (import.meta.url === entrypoint) {
  await main();
}
