import { readFileSync } from "fs"
import path from "path"

const ASSOCIATION_FILENAME = "apple-developer-domain-association"

/** Raw JSON body Apple expects at /.well-known/apple-developer-domain-association */
export function getAppleDomainAssociationBody(): string | null {
  const fromEnv = process.env.APPLE_DOMAIN_ASSOCIATION?.trim()
  if (fromEnv) {
    return fromEnv
  }

  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      ".well-known",
      ASSOCIATION_FILENAME,
    )
    return readFileSync(filePath, "utf8").trim()
  } catch {
    return null
  }
}
