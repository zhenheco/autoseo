'use client'

import { cn } from "@/lib/utils"

export function BackgroundGradientMesh({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="gradient-mesh absolute inset-0 opacity-30" />
    </div>
  )
}

export function BackgroundGrid({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10", className)}>
      <div className="absolute inset-0" style={{
        backgroundImage: `
          linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
        `,
        backgroundSize: '50px 50px'
      }} />
    </div>
  )
}

export function BackgroundSpotlight({ className }: { className?: string }) {
  return (
    <div className={cn("absolute inset-0 -z-10 overflow-hidden", className)}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-primary/20 blur-3xl" />
    </div>
  )
}

export function FloatingShapes() {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      <div className="absolute top-20 left-10 w-64 h-64 rounded-full bg-gradient-purple-blue opacity-10 blur-3xl animate-float" />
      <div className="absolute top-40 right-20 w-80 h-80 rounded-full bg-gradient-blue-cyan opacity-10 blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 rounded-full bg-gradient-purple-pink opacity-10 blur-3xl animate-float" style={{ animationDelay: '3s' }} />

      <svg className="absolute top-1/4 left-1/4 w-16 h-16 text-primary/20 animate-float" viewBox="0 0 200 200" fill="currentColor">
        <polygon points="100,10 40,198 190,78 10,78 160,198" />
      </svg>

      <svg className="absolute top-1/2 right-1/4 w-20 h-20 text-secondary/20 animate-float" style={{ animationDelay: '2s' }} viewBox="0 0 200 200" fill="currentColor">
        <circle cx="100" cy="100" r="80" />
      </svg>

      <svg className="absolute bottom-1/4 right-1/3 w-14 h-14 text-primary/20 animate-float" style={{ animationDelay: '4s' }} viewBox="0 0 200 200" fill="currentColor">
        <rect x="50" y="50" width="100" height="100" rx="10" />
      </svg>
    </div>
  )
}

export function ParticleField({ count = 30 }: { count?: number }) {
  const particles = Array.from({ length: count }, (_, i) => ({
    id: i,
    size: Math.random() * 4 + 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    duration: Math.random() * 10 + 10,
    delay: Math.random() * 5
  }))

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full bg-primary/30 animate-float"
          style={{
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            animationDuration: `${particle.duration}s`,
            animationDelay: `${particle.delay}s`
          }}
        />
      ))}
    </div>
  )
}
