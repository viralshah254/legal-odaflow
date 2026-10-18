"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export interface AnalysisVisualization {
  type: "bar" | "pie" | "timeline" | "risk_matrix"
  title: string
  data: { label: string; value: number; color?: string }[]
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 220 70% 50%))",
  "hsl(var(--chart-3, 160 60% 45%))",
  "hsl(var(--chart-4, 30 80% 55%))",
  "hsl(var(--chart-5, 280 65% 60%))",
]

export function AnalysisChart({ viz }: { viz: AnalysisVisualization }) {
  const chartType = viz.type === "risk_matrix" ? "bar" : viz.type === "timeline" ? "bar" : viz.type

  if (!viz.data?.length) return null

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium">{viz.title}</CardTitle>
      </CardHeader>
      <CardContent className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={viz.data}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={70}
                label={({ label, value }) => `${label}: ${value}`}
              >
                {viz.data.map((entry, index) => (
                  <Cell
                    key={entry.label}
                    fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : (
            <BarChart data={viz.data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {viz.data.map((entry, index) => (
                  <Cell
                    key={entry.label}
                    fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
