"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function BackgroundGradientMesh({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="gradient-mesh absolute inset-0 opacity-30" />
    </div>
  );
}

export function AnimatedGradientBackground({
  className,
  children,
  containerClassName,
}: {
  className?: string;
  children?: React.ReactNode;
  containerClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      <motion.div
        className={cn(
          "absolute inset-0 -z-10",
          "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900",
          "animated-gradient-bg",
          className,
        )}
        animate={{
          backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear",
        }}
      />
      {children}
    </div>
  );
}

export function AuroraBackground({
  className,
  showRadialGradient = true,
}: {
  className?: string;
  showRadialGradient?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-0",
          "bg-gradient-to-b from-slate-900 via-indigo-950/50 to-slate-900",
        )}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(0, 85, 255, 0.15) 0%, rgba(0, 221, 235, 0.15) 50%, rgba(255, 77, 0, 0.15) 100%)",
        }}
        animate={{
          opacity: [0.3, 0.5, 0.3],
          scale: [1, 1.05, 1],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      {showRadialGradient && (
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0, 85, 255, 0.3) 0%, transparent 60%)",
          }}
        />
      )}
    </div>
  );
}

export function CyberGlow({
  className,
  position = "top",
  color = "violet",
}: {
  className?: string;
  position?: "top" | "center" | "bottom";
  color?: "cyan" | "violet" | "magenta" | "mixed";
}) {
  const positionClasses = {
    top: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  };

  const colorStyles = {
    cyan: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(6, 182, 212, 0.4) 0%, transparent 70%)",
    violet:
      "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139, 92, 246, 0.4) 0%, transparent 70%)",
    magenta:
      "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(236, 72, 153, 0.4) 0%, transparent 70%)",
    mixed:
      "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(6, 182, 212, 0.3) 0%, rgba(139, 92, 246, 0.2) 40%, transparent 70%)",
  };

  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block",
        className,
      )}
    >
      <motion.div
        className={cn(
          "absolute w-[800px] h-[500px] rounded-full blur-3xl",
          positionClasses[position],
        )}
        style={{
          background: colorStyles[color],
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

export function BackgroundGrid({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const gridColor =
    variant === "dark"
      ? "rgba(255, 255, 255, 0.03)"
      : "rgba(59, 130, 246, 0.05)";

  return (
    <div className={cn("absolute inset-0 -z-10", className)}>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
          linear-gradient(${gridColor} 1px, transparent 1px),
          linear-gradient(90deg, ${gridColor} 1px, transparent 1px)
        `,
          backgroundSize: "50px 50px",
        }}
      />
    </div>
  );
}

export function BackgroundSpotlight({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-tech-blue-500/20 blur-3xl" />
    </div>
  );
}

export function GlowSpotlight({
  className,
  position = "top",
}: {
  className?: string;
  position?: "top" | "center" | "bottom";
}) {
  const positionClasses = {
    top: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
    center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
    bottom: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2",
  };

  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden pointer-events-none",
        className,
      )}
    >
      <div
        className={cn(
          "absolute w-[600px] h-[400px] rounded-full blur-3xl",
          positionClasses[position],
        )}
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(139, 92, 246, 0.35) 0%, rgba(6, 182, 212, 0.15) 50%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function HeroGlow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block",
        className,
      )}
    >
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px]"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(139, 92, 246, 0.35) 0%, rgba(6, 182, 212, 0.15) 40%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function FloatingOrbs({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block",
        className,
      )}
    >
      <motion.div
        className="absolute top-20 left-[10%] w-64 h-64 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(6, 182, 212, 0.4) 0%, rgba(6, 182, 212, 0.1) 50%, transparent 70%)",
          filter: "blur(40px)",
        }}
        animate={{
          x: [0, 20, -10, 0],
          y: [0, -30, -15, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-40 right-[15%] w-80 h-80 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(139, 92, 246, 0.35) 0%, rgba(139, 92, 246, 0.1) 50%, transparent 70%)",
          filter: "blur(50px)",
        }}
        animate={{
          x: [0, -25, 15, 0],
          y: [0, 20, -20, 0],
          scale: [1, 0.9, 1.05, 1],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />
      <motion.div
        className="absolute bottom-20 left-[30%] w-72 h-72 rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0.1) 50%, transparent 70%)",
          filter: "blur(45px)",
        }}
        animate={{
          x: [0, 15, -20, 0],
          y: [0, -25, 10, 0],
          scale: [1, 1.05, 0.9, 1],
        }}
        transition={{
          duration: 18,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 4,
        }}
      />
    </div>
  );
}

export function FloatingShapes() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-tech-blue-500/10 blur-3xl animate-float" />
      <div
        className="absolute top-40 right-20 w-80 h-80 rounded-full bg-tech-blue-400/10 blur-3xl animate-float"
        style={{ animationDelay: "1.5s" }}
      />
      <div
        className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full bg-purple-500/10 blur-3xl animate-float"
        style={{ animationDelay: "3s" }}
      />

      <svg
        className="absolute top-1/4 left-1/4 w-16 h-16 text-tech-blue-500/20 animate-float"
        viewBox="0 0 200 200"
        fill="currentColor"
      >
        <polygon points="100,10 40,198 190,78 10,78 160,198" />
      </svg>

      <svg
        className="absolute top-1/2 right-1/4 w-20 h-20 text-purple-500/20 animate-float"
        style={{ animationDelay: "2s" }}
        viewBox="0 0 200 200"
        fill="currentColor"
      >
        <circle cx="100" cy="100" r="80" />
      </svg>

      <svg
        className="absolute bottom-1/4 right-1/3 w-14 h-14 text-tech-blue-500/20 animate-float"
        style={{ animationDelay: "4s" }}
        viewBox="0 0 200 200"
        fill="currentColor"
      >
        <rect x="50" y="50" width="100" height="100" rx="10" />
      </svg>
    </div>
  );
}

export function ParticleField({
  count = 30,
  variant = "blue",
}: {
  count?: number;
  variant?: "blue" | "mixed";
}) {
  const [particles] = React.useState(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 2,
      x: Math.random() * 100,
      y: Math.random() * 100,
      duration: Math.random() * 10 + 10,
      delay: Math.random() * 5,
      isPurple: variant === "mixed" && Math.random() > 0.7,
    })),
  );

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none hidden dark:block">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className={cn(
            "absolute rounded-full animate-float",
            particle.isPurple ? "bg-purple-500/30" : "bg-tech-blue-500/30",
          )}
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

export function DarkSectionBackground({
  className,
  withGrid = true,
  withGlow = true,
}: {
  className?: string;
  withGrid?: boolean;
  withGlow?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 -z-10 bg-dark-section", className)}>
      {withGrid && <BackgroundGrid variant="dark" />}
      {withGlow && <HeroGlow />}
    </div>
  );
}

export function LightSectionBackground({
  className,
  withGrid = true,
}: {
  className?: string;
  withGrid?: boolean;
}) {
  return (
    <div className={cn("absolute inset-0 -z-10 bg-light-section", className)}>
      {withGrid && <BackgroundGrid variant="light" />}
    </div>
  );
}
