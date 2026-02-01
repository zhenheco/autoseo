"use client";

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from 'next-intl'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  trend?: {
    value: number
    isPositive: boolean
  }
  iconBgColor?: string
  iconColor?: string
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  iconBgColor = 'bg-primary/10',
  iconColor = 'text-primary',
}: StatCardProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="group bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 p-6 card-hover-lift hover:shadow-xl hover:border-primary/50 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-3">
            {title}
          </p>
          <p className="text-4xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-base font-semibold',
                  trend.isPositive ? 'text-success' : 'text-danger'
                )}
              >
                {trend.isPositive ? '+' : ''}
                {trend.value}%
              </span>
              <span className="text-sm text-muted-foreground">{t("vsLastWeek")}</span>
            </div>
          )}
        </div>
        <div className={cn('p-4 rounded-xl group-hover:scale-110 transition-transform', iconBgColor)}>
          <Icon className={cn('h-7 w-7', iconColor)} />
        </div>
      </div>
    </div>
  )
}
