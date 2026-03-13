import * as React from "react";
import { cn } from "@/lib/utils/cn";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value?: number;
  onValueChange?: (value: number) => void;
}

const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, value = 0, onValueChange, ...props }, ref) => (
    <input
      type="range"
      ref={ref}
      value={value}
      onChange={(e) => onValueChange?.(parseFloat(e.target.value))}
      className={cn(
        "w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary",
        className
      )}
      {...props}
    />
  )
);
Slider.displayName = "Slider";

export { Slider };
