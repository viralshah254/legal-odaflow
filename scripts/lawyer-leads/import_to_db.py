#!/usr/bin/env python3
"""Import lawyer prospects CSV into Postgres (direct) or admin API."""

from __future__ import annotations

import argparse
import csv
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from models import ProspectRecord, make_dedupe_key

BACKEND_ENV = _ROOT.parent.parent / "legal_backend" / ".env"


def load_backend_env() -> None:
    """Load DATABASE_URL and API_URL from legal_backend/.env if not set."""
    if not BACKEND_ENV.exists():
        return
    for line in BACKEND_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key in ("DATABASE_URL", "API_URL", "LEGAL_API_URL") and not os.environ.get(key):
            os.environ[key] = value
    if not os.environ.get("LEGAL_API_URL") and os.environ.get("API_URL"):
        os.environ["LEGAL_API_URL"] = os.environ["API_URL"]


def resolve_import_api_url(api_url: str) -> str:
    """NestJS admin routes live under /api/v1 on the backend host (not the Next.js web app)."""
    base = api_url.rstrip("/")
    if "umbrella.okaylegal.ai" in base and "legal-api" not in base:
        print(
            "[warn] --api-url points at the web app (HTML). Use the backend API instead, e.g.\n"
            "       https://legal-api.odaflow.com",
            file=sys.stderr,
        )
    if base.endswith("/api/v1"):
        prefix = base
    elif "/api/v1" in base:
        prefix = base.split("/api/v1")[0] + "/api/v1"
    else:
        prefix = f"{base}/api/v1"
    return f"{prefix}/admin/lawyer-prospects/import"


def import_via_api(
    csv_path: Path,
    api_url: str,
    batch_label: str,
    token: str | None,
) -> dict:
    import requests

    url = resolve_import_api_url(api_url)
    headers = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    with csv_path.open("rb") as f:
        files = {"file": (csv_path.name, f, "text/csv")}
        data = {"batchLabel": batch_label}
        resp = requests.post(url, files=files, data=data, headers=headers, timeout=600)
    if not resp.ok:
        snippet = (resp.text or "")[:500]
        raise RuntimeError(
            f"Import API HTTP {resp.status_code} from {url}: {snippet or '(empty body)'}"
        )
    try:
        return resp.json()
    except ValueError as exc:
        snippet = (resp.text or "")[:500]
        raise RuntimeError(
            f"Import API returned non-JSON from {url}: {snippet or '(empty body)'}"
        ) from exc


def _parse_csv_rows(csv_path: Path) -> list[dict[str, str]]:
    with csv_path.open(encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def import_via_node_prisma(csv_path: Path, batch_label: str) -> dict:
    """Fallback: use Prisma in legal_backend (no psycopg2 required)."""
    import json
    import subprocess
    import tempfile

    rows = _parse_csv_rows(csv_path)
    backend = _ROOT.parent.parent / "legal_backend"
    script = r"""
const path = require('path');
const { PrismaClient } = require(path.join(process.cwd(), 'node_modules/@prisma/client'));
const fs = require('fs');
const crypto = require('crypto');

function normalizeKeyPart(value) {
  if (!value) return '';
  return String(value).trim().toLowerCase().replace(/\s+/g, ' ');
}

function dedupeKey(name, org, city) {
  const raw = [normalizeKeyPart(name), normalizeKeyPart(org), normalizeKeyPart(city)].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function isRetryableDbError(err) {
  const msg = String(err?.message || err);
  return (
    msg.includes('closed the connection') ||
    msg.includes("Can't reach database") ||
    msg.includes('P1001') ||
    msg.includes('P1017')
  );
}

let prisma = new PrismaClient();

async function withRetry(fn) {
  const maxAttempts = 10;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableDbError(err) || attempt === maxAttempts) throw err;
      await prisma.$disconnect().catch(() => {});
      prisma = new PrismaClient();
      await new Promise((r) => setTimeout(r, Math.min(2000 * attempt, 15000)));
    }
  }
}

async function main() {
  const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  const run = await withRetry(() =>
    prisma.prospectImportRun.create({
      data: { batchLabel: process.argv[3], sourceSummary: 'python-import', status: 'RUNNING' },
    }),
  );
  let inserted = 0, updated = 0, skipped = 0;
  for (const row of rows) {
    const fullName = row.full_name || `${row.first_name || ''} ${row.last_name || ''}`.trim();
    if (!fullName) { skipped++; continue; }
    const key = (row.id || '').trim() || dedupeKey(fullName, row.organisation, row.city);
    const data = {
      fullName, firstName: row.first_name || null, lastName: row.last_name || null,
      organisation: row.organisation || null, practiceAreas: row.practice_areas || null,
      city: row.city || null, state: row.state || null, country: row.country || null,
      phone: row.phone || null, alternatePhone: row.alternate_phone || null,
      whatsapp: row.whatsapp || null,
      whatsappConfidence: row.whatsapp_confidence || null,
      email: row.email || null, emailConfidence: row.email_confidence || null,
      website: row.website || null, profileUrl: row.profile_url || null,
      barEnrollmentNumber: row.bar_enrollment_number || null,
      barCouncilState: row.bar_council_state || null,
      lawyerVerified: ['true','1','yes'].includes(String(row.lawyer_verified || '').toLowerCase()),
      verifiedAt: row.verified_at ? new Date(row.verified_at) : null,
      source: row.source || 'import', dedupeKey: key,
      scrapedAt: row.scraped_at ? new Date(row.scraped_at) : new Date(),
      importRun: { connect: { id: run.id } },
    };
    await withRetry(async () => {
      const existing = await prisma.lawyerProspect.findUnique({ where: { dedupeKey: key } });
      if (existing) {
        await prisma.lawyerProspect.update({ where: { dedupeKey: key }, data });
        updated++;
        return;
      }
      try {
        await prisma.lawyerProspect.create({ data });
        inserted++;
      } catch (err) {
        if (err?.code === 'P2002') {
          await prisma.lawyerProspect.update({ where: { dedupeKey: key }, data });
          updated++;
          return;
        }
        throw err;
      }
    });
    const done = inserted + updated + skipped;
    if (done % 250 === 0) {
      console.error(`[import] ${done}/${rows.length} (inserted=${inserted}, updated=${updated}, skipped=${skipped})`);
    }
  }
  await withRetry(() =>
    prisma.prospectImportRun.update({
      where: { id: run.id },
      data: { status: 'COMPLETED', rowCount: rows.length, insertedCount: inserted,
        updatedCount: updated, skippedCount: skipped, finishedAt: new Date() },
    }),
  );
  console.log(JSON.stringify({ inserted, updated, skipped, rowCount: rows.length, runId: run.id }));
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
"""
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as jf:
        json.dump(rows, jf)
        jf.flush()
        json_path = jf.name
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as tmp:
        tmp.write(script)
        js_path = tmp.name
    try:
        result = subprocess.run(
            ["node", js_path, json_path, batch_label],
            cwd=str(backend),
            capture_output=True,
            text=True,
            env={**os.environ},
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr or result.stdout)
        return json.loads(result.stdout.strip().split("\n")[-1])
    finally:
        Path(js_path).unlink(missing_ok=True)
        Path(json_path).unlink(missing_ok=True)


def import_via_postgres(csv_path: Path, batch_label: str) -> dict:
    try:
        import psycopg2
    except ImportError:
        return import_via_node_prisma(csv_path, batch_label)

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")

    rows = _parse_csv_rows(csv_path)
    if not rows:
        return {"inserted": 0, "updated": 0, "skipped": 0, "rowCount": 0, "runId": None}

    run_id = str(uuid.uuid4()).replace("-", "")[:25]
    # cuid-like id
    run_id = "c" + run_id[:24]

    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute(
            """
            INSERT INTO "ProspectImportRun"
              (id, "batchLabel", "sourceSummary", status, "rowCount",
               "insertedCount", "updatedCount", "skippedCount", "startedAt")
            VALUES (%s, %s, %s, 'RUNNING', 0, 0, 0, 0, %s)
            """,
            (run_id, batch_label, "python-import", datetime.now(timezone.utc)),
        )

        inserted = updated = skipped = 0
        for row in rows:
            full_name = (row.get("full_name") or "").strip()
            if not full_name:
                first = (row.get("first_name") or "").strip()
                last = (row.get("last_name") or "").strip()
                full_name = f"{first} {last}".strip()
            if not full_name:
                skipped += 1
                continue

            key = (row.get("id") or "").strip() or make_dedupe_key(
                full_name, row.get("organisation"), row.get("city")
            )
            scraped_raw = row.get("scraped_at")
            scraped_at = datetime.now(timezone.utc)
            if scraped_raw:
                try:
                    scraped_at = datetime.fromisoformat(
                        scraped_raw.replace("Z", "+00:00")
                    )
                except ValueError:
                    pass

            cur.execute(
                'SELECT id FROM "LawyerProspect" WHERE "dedupeKey" = %s',
                (key,),
            )
            existing = cur.fetchone()
            prospect_id = existing[0] if existing else ("c" + uuid.uuid4().hex[:24])

            alternate_phone = row.get("alternate_phone") or None
            lawyer_verified = str(row.get("lawyer_verified") or "").lower() in ("true", "1", "yes")
            verified_at_raw = row.get("verified_at")
            verified_at = None
            if verified_at_raw:
                try:
                    verified_at = datetime.fromisoformat(verified_at_raw.replace("Z", "+00:00"))
                except ValueError:
                    verified_at = datetime.now(timezone.utc) if lawyer_verified else None
            fields = (
                prospect_id,
                full_name,
                row.get("first_name") or None,
                row.get("last_name") or None,
                row.get("organisation") or None,
                row.get("practice_areas") or None,
                row.get("city") or None,
                row.get("state") or None,
                row.get("country") or None,
                row.get("phone") or None,
                alternate_phone,
                row.get("whatsapp") or None,
                row.get("whatsapp_confidence") or None,
                row.get("email") or None,
                row.get("email_confidence") or None,
                row.get("website") or None,
                row.get("profile_url") or None,
                row.get("bar_enrollment_number") or None,
                row.get("bar_council_state") or None,
                lawyer_verified,
                verified_at,
                row.get("source") or "import",
                key,
                run_id,
                scraped_at,
            )

            if existing:
                cur.execute(
                    """
                    UPDATE "LawyerProspect" SET
                      "fullName"=%s, "firstName"=%s, "lastName"=%s,
                      organisation=%s, "practiceAreas"=%s, city=%s, state=%s,
                      country=%s, phone=%s, "alternatePhone"=%s, whatsapp=%s, "whatsappConfidence"=%s,
                      email=%s, "emailConfidence"=%s, website=%s, "profileUrl"=%s,
                      "barEnrollmentNumber"=%s, "barCouncilState"=%s, "lawyerVerified"=%s, "verifiedAt"=%s,
                      source=%s, "importRunId"=%s, "scrapedAt"=%s, "updatedAt"=%s
                    WHERE "dedupeKey"=%s
                    """,
                    (
                        full_name,
                        fields[2], fields[3], fields[4], fields[5], fields[6],
                        fields[7], fields[8], fields[9], fields[10], fields[11],
                        fields[12], fields[13], fields[14], fields[15], fields[16],
                        fields[17], fields[18], fields[19], fields[20],
                        fields[21],
                        run_id, scraped_at, datetime.now(timezone.utc), key,
                    ),
                )
                updated += 1
            else:
                cur.execute(
                    """
                    INSERT INTO "LawyerProspect" (
                      id, "fullName", "firstName", "lastName", organisation,
                      "practiceAreas", city, state, country, phone, "alternatePhone",
                      whatsapp, "whatsappConfidence", email, "emailConfidence", website,
                      "profileUrl", "barEnrollmentNumber", "barCouncilState", "lawyerVerified", "verifiedAt",
                      source, "dedupeKey", "outreachStatus",
                      "importRunId", "scrapedAt", "createdAt", "updatedAt"
                    ) VALUES (
                      %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,
                      'NEW',%s,%s,%s,%s
                    )
                    """,
                    (
                        prospect_id, full_name,
                        fields[2], fields[3], fields[4], fields[5], fields[6],
                        fields[7], fields[8], fields[9], fields[10], fields[11],
                        fields[12], fields[13], fields[14], fields[15], fields[16],
                        fields[17], fields[18], fields[19], fields[20],
                        fields[21], fields[22],
                        run_id, scraped_at, datetime.now(timezone.utc), datetime.now(timezone.utc),
                    ),
                )
                inserted += 1

        cur.execute(
            """
            UPDATE "ProspectImportRun" SET
              status='COMPLETED', "rowCount"=%s, "insertedCount"=%s,
              "updatedCount"=%s, "skippedCount"=%s, "finishedAt"=%s
            WHERE id=%s
            """,
            (len(rows), inserted, updated, skipped, datetime.now(timezone.utc), run_id),
        )
        conn.commit()
        return {
            "runId": run_id,
            "inserted": inserted,
            "updated": updated,
            "skipped": skipped,
            "rowCount": len(rows),
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def import_csv(
    csv_path: Path,
    batch_label: str = "csv-import",
    api_url: str | None = None,
    *,
    prefer_api: bool = False,
) -> dict:
    load_backend_env()
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    rows = _parse_csv_rows(csv_path)
    if not rows:
        print("[warn] CSV has no data rows — run scrape with --reset-checkpoints first")
        return {"inserted": 0, "updated": 0, "skipped": 0, "rowCount": 0}

    token = os.environ.get("ADMIN_ACCESS_TOKEN") or os.environ.get("LEGAL_ACCESS_TOKEN")
    resolved_api = api_url or os.environ.get("LEGAL_API_URL") or os.environ.get("API_URL")

    if prefer_api or api_url:
        if not resolved_api:
            raise RuntimeError("--api-url is required for API import")
        if not token:
            raise RuntimeError(
                "Set ADMIN_ACCESS_TOKEN (super-admin JWT) for API import.\n"
                "  export ADMIN_ACCESS_TOKEN='eyJ...'\n"
                f"  python import_to_db.py --csv {csv_path} --api-url {resolved_api}"
            )
        return import_via_api(csv_path, resolved_api, batch_label, token)

    if resolved_api and token:
        return import_via_api(csv_path, resolved_api, batch_label, token)

    if os.environ.get("DATABASE_URL"):
        print("[info] importing via DATABASE_URL (direct Postgres)", file=sys.stderr)
        return import_via_postgres(csv_path, batch_label)

    if resolved_api:
        raise RuntimeError(
            "Set ADMIN_ACCESS_TOKEN (super-admin JWT) for API import, or use DATABASE_URL"
        )
    raise RuntimeError(
        "Could not load DATABASE_URL from legal_backend/.env. "
        "Run from repo root or set DATABASE_URL / --api-url"
    )


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--csv", required=True)
    p.add_argument("--source-batch", dest="batch_label", default="csv-import")
    p.add_argument(
        "--api-url",
        default=None,
        help="Backend API base (e.g. https://legal-api.odaflow.com). Prefer API over DATABASE_URL.",
    )
    args = p.parse_args()
    result = import_csv(
        Path(args.csv),
        args.batch_label,
        args.api_url,
        prefer_api=bool(args.api_url),
    )
    print(result)


if __name__ == "__main__":
    main()
