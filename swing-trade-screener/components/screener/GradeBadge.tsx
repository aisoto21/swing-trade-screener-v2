"use client";

import { memo } from "react";
import type { SetupGrade } from "@/types";
import { cn } from "@/lib/utils/cn";

const GRADE_COLORS: Record<SetupGrade, string> = {
  "A+": "text-[var(--grade-aplus)]",
  A: "text-[var(--grade-a)]",
  B: "text-[var(--grade-b)]",
  C: "text-[var(--grade-c)]",
};

interface GradeBadgeProps {
  grade: SetupGrade;
  className?: string;
}

export const GradeBadge = memo(function GradeBadge({ grade, className }: GradeBadgeProps) {
  return (
    <span className={cn("font-mono text-xs font-medium", GRADE_COLORS[grade], className)}>
      {grade}
    </span>
  );
});
