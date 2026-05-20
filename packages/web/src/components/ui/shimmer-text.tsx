"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  shimmerWidth?: number;
  duration?: number;
}

export function ShimmerText({
  children,
  className,
  as: Component = "span",
  shimmerWidth = 200,
  duration = 8,
}: ShimmerTextProps) {
  return (
    <Component
      className={cn(
        "inline-block bg-clip-text text-transparent",
        "bg-[length:200%_auto]",
        "shimmer-text",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, #06b6d4 0%, #8b5cf6 25%, #ec4899 50%, #8b5cf6 75%, #06b6d4 100%)",
        backgroundSize: `${shimmerWidth}% auto`,
      }}
    >
      {children}
    </Component>
  );
}

export function AnimatedShimmerText({
  children,
  className,
  as: Component = "span",
  duration = 8,
}: ShimmerTextProps) {
  return (
    <motion.span
      className={cn(
        "inline-block bg-clip-text text-transparent",
        "bg-[length:200%_auto]",
        className,
      )}
      style={{
        backgroundImage:
          "linear-gradient(90deg, #06b6d4 0%, #8b5cf6 25%, #ec4899 50%, #8b5cf6 75%, #06b6d4 100%)",
        backgroundSize: "200% auto",
      }}
      animate={{
        backgroundPosition: ["0% center", "200% center"],
      }}
      transition={{
        duration,
        repeat: Infinity,
        ease: "linear",
      }}
    >
      {Component === "span" ? (
        children
      ) : (
        <Component className="inline">{children}</Component>
      )}
    </motion.span>
  );
}

export function GradientText({
  children,
  className,
  as: Component = "span",
  gradient = "cyan-violet-magenta",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span";
  gradient?: "cyan-violet-magenta" | "violet-magenta" | "cyan-violet";
}) {
  const gradients = {
    "cyan-violet-magenta":
      "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%)",
    "violet-magenta": "linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)",
    "cyan-violet": "linear-gradient(135deg, #06b6d4 0%, #8b5cf6 100%)",
  };

  return (
    <Component
      className={cn("inline-block bg-clip-text text-transparent", className)}
      style={{
        backgroundImage: gradients[gradient],
      }}
    >
      {children}
    </Component>
  );
}
