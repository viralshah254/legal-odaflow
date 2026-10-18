"use client"

import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"

const LIGHT_LOGO = "/brand/umbrella-logo-light.png"
const DARK_LOGO = "/brand/umbrella-logo-dark.png"

/** Intrinsic dimensions of exported brand assets (1024px max edge). */
const LIGHT_ASPECT = 1024 / 432
const DARK_ASPECT = 1024 / 416

interface UmbrellaLogoProps {
  className?: string
  height?: number
  href?: string
  link?: boolean
  priority?: boolean
  /** White wordmark for dark or brand-blue backgrounds */
  appearance?: "auto" | "onBrand"
}

export function UmbrellaLogo({
  className,
  height = 36,
  href = "/",
  link = true,
  priority = false,
  appearance = "auto",
}: UmbrellaLogoProps) {
  const lightWidth = Math.round(height * LIGHT_ASPECT)
  const darkWidth = Math.round(height * DARK_ASPECT)
  const width = Math.max(lightWidth, darkWidth)

  const image =
    appearance === "onBrand" ? (
      <span className={cn("relative inline-flex shrink-0", className)} style={{ height, width: darkWidth }}>
        <Image
          src={DARK_LOGO}
          alt="Umbrella"
          width={darkWidth}
          height={height}
          priority={priority}
          className="h-full w-auto max-w-full object-contain object-left"
        />
      </span>
    ) : (
      <span className={cn("relative inline-flex shrink-0", className)} style={{ height, width }}>
        <Image
          src={LIGHT_LOGO}
          alt="Umbrella"
          width={lightWidth}
          height={height}
          priority={priority}
          className="h-full w-auto max-w-full object-contain object-left dark:hidden"
        />
        <Image
          src={DARK_LOGO}
          alt="Umbrella"
          width={darkWidth}
          height={height}
          priority={priority}
          className="hidden h-full w-auto max-w-full object-contain object-left dark:block"
        />
      </span>
    )

  if (!link) {
    return image
  }

  return (
    <Link href={href} className="inline-flex shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
      {image}
    </Link>
  )
}
