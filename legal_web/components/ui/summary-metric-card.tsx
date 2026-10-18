import * as React from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type SummaryMetricCardBaseProps = {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  description?: React.ReactNode
  className?: string
  iconClassName?: string
  "aria-label"?: string
}

type SummaryMetricCardLinkProps = SummaryMetricCardBaseProps & {
  href: string
  onClick?: React.MouseEventHandler<HTMLAnchorElement>
  disabled?: never
}

type SummaryMetricCardButtonProps = SummaryMetricCardBaseProps & {
  href?: never
  onClick: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
}

type SummaryMetricCardStaticProps = SummaryMetricCardBaseProps & {
  href?: never
  onClick?: never
  disabled?: never
}

export type SummaryMetricCardProps =
  | SummaryMetricCardLinkProps
  | SummaryMetricCardButtonProps
  | SummaryMetricCardStaticProps

const baseClassName =
  "flex w-full items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-4 text-left text-card-foreground shadow-[0_1px_4px_0_rgb(0_0_0/0.06)] dark:shadow-[0_2px_8px_0_rgb(0_0_0/0.45)]"

const interactiveClassName =
  "transition-all duration-150 hover:-translate-y-px hover:border-primary/30 hover:bg-accent/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:translate-y-0 disabled:pointer-events-none disabled:opacity-50"

function SummaryMetricCardContent({
  label,
  value,
  icon: Icon,
  description,
  iconClassName,
}: Pick<
  SummaryMetricCardBaseProps,
  "label" | "value" | "icon" | "description" | "iconClassName"
>) {
  return (
    <>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 block text-2xl font-semibold leading-tight tabular-nums">
          {value}
        </span>
        {description ? (
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            {description}
          </span>
        ) : null}
      </span>
      {Icon ? (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon
            className={cn("h-4 w-4 text-primary", iconClassName)}
            aria-hidden="true"
          />
        </span>
      ) : null}
    </>
  )
}

/**
 * Compact record metric. Supplying `href` renders a link; supplying `onClick`
 * renders a native button. With neither, it remains a non-interactive summary.
 */
export function SummaryMetricCard(props: SummaryMetricCardProps) {
  const {
    label,
    value,
    icon,
    description,
    className,
    iconClassName,
    "aria-label": ariaLabel,
  } = props
  const content = (
    <SummaryMetricCardContent
      label={label}
      value={value}
      icon={icon}
      description={description}
      iconClassName={iconClassName}
    />
  )

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        aria-label={ariaLabel}
        className={cn(baseClassName, interactiveClassName, className)}
      >
        {content}
      </Link>
    )
  }

  if ("onClick" in props && props.onClick) {
    const buttonProps = props as SummaryMetricCardButtonProps
    return (
      <button
        type="button"
        onClick={buttonProps.onClick}
        disabled={buttonProps.disabled}
        aria-label={ariaLabel}
        className={cn(baseClassName, interactiveClassName, className)}
      >
        {content}
      </button>
    )
  }

  return (
    <div aria-label={ariaLabel} className={cn(baseClassName, className)}>
      {content}
    </div>
  )
}
