"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowButtonProps {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  glowColor?: "violet" | "cyan" | "magenta" | "mixed";
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
}

export function GlowButton({
  children,
  className,
  variant = "primary",
  size = "md",
  glowColor = "violet",
  onClick,
  disabled,
  type = "button",
}: GlowButtonProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantClasses = {
    primary: cn(
      "bg-gradient-to-r from-violet-600 to-pink-600",
      "hover:from-violet-500 hover:to-pink-500",
      "text-white font-semibold",
    ),
    secondary: cn(
      "bg-slate-800/80 backdrop-blur-sm",
      "border border-white/10",
      "hover:bg-slate-700/80 hover:border-white/20",
      "text-white font-medium",
    ),
    outline: cn(
      "bg-transparent",
      "border-2 border-violet-500/50",
      "hover:border-violet-400 hover:bg-violet-500/10",
      "text-white font-medium",
    ),
  };

  const glowStyles = {
    violet:
      "0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)",
    cyan: "0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)",
    magenta:
      "0 0 20px rgba(236, 72, 153, 0.4), 0 0 40px rgba(236, 72, 153, 0.2)",
    mixed: "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(6, 182, 212, 0.2)",
  };

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-xl",
        "transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-slate-900",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        sizeClasses[size],
        variantClasses[variant],
        variant === "primary" && "glow-button",
        className,
      )}
      whileHover={{
        scale: 1.02,
        boxShadow: glowStyles[glowColor],
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.button>
  );
}

interface GlowButtonLinkProps {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  glowColor?: "violet" | "cyan" | "magenta" | "mixed";
  href: string;
}

export function GlowButtonLink({
  children,
  className,
  variant = "primary",
  size = "md",
  glowColor = "violet",
  href,
}: GlowButtonLinkProps) {
  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantClasses = {
    primary: cn(
      "bg-gradient-to-r from-violet-600 to-pink-600",
      "hover:from-violet-500 hover:to-pink-500",
      "text-white font-semibold",
    ),
    secondary: cn(
      "bg-slate-800/80 backdrop-blur-sm",
      "border border-white/10",
      "hover:bg-slate-700/80 hover:border-white/20",
      "text-white font-medium",
    ),
    outline: cn(
      "bg-transparent",
      "border-2 border-violet-500/50",
      "hover:border-violet-400 hover:bg-violet-500/10",
      "text-white font-medium",
    ),
  };

  const glowStyles = {
    violet:
      "0 0 20px rgba(139, 92, 246, 0.4), 0 0 40px rgba(139, 92, 246, 0.2)",
    cyan: "0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2)",
    magenta:
      "0 0 20px rgba(236, 72, 153, 0.4), 0 0 40px rgba(236, 72, 153, 0.2)",
    mixed: "0 0 20px rgba(139, 92, 246, 0.3), 0 0 40px rgba(6, 182, 212, 0.2)",
  };

  return (
    <motion.a
      href={href}
      className={cn(
        "relative inline-flex items-center justify-center",
        "rounded-xl",
        "transition-all duration-300",
        "focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:ring-offset-2 focus:ring-offset-slate-900",
        sizeClasses[size],
        variantClasses[variant],
        variant === "primary" && "glow-button",
        className,
      )}
      whileHover={{
        scale: 1.02,
        boxShadow: glowStyles[glowColor],
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.a>
  );
}

export function GlassCard({
  children,
  className,
  hover = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <motion.div
      className={cn(
        "glass rounded-2xl p-6",
        "transition-all duration-300",
        className,
      )}
      whileHover={
        hover
          ? {
              y: -8,
              boxShadow: "0 20px 40px rgba(139, 92, 246, 0.15)",
              borderColor: "rgba(139, 92, 246, 0.5)",
            }
          : undefined
      }
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
