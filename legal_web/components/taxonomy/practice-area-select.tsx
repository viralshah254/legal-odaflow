"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  PRACTICE_AREAS,
  practiceAreaLabel,
  resolvePracticeAreaSlug,
} from "@/lib/taxonomy/platform-taxonomy"

interface PracticeAreaSelectProps {
  value: string
  onChange: (slug: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true, value is normalized through resolvePracticeAreaSlug on display */
  normalizeValue?: boolean
}

export function PracticeAreaSelect({
  value,
  onChange,
  placeholder = "Select practice area",
  className,
  disabled,
  normalizeValue = true,
}: PracticeAreaSelectProps) {
  const resolved = normalizeValue && value ? resolvePracticeAreaSlug(value) : value

  return (
    <Select value={resolved || undefined} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {PRACTICE_AREAS.map((area) => (
          <SelectItem key={area.slug} value={area.slug}>
            {area.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { practiceAreaLabel, resolvePracticeAreaSlug, PRACTICE_AREAS }
