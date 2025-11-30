"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompany } from "./actions";

interface Company {
  id: string;
  name: string;
}

interface SettingsClientProps {
  company: Company;
  searchParams: { error?: string; success?: string; info?: string };
}

export function SettingsClient({ company, searchParams }: SettingsClientProps) {
  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">設定</h1>
        <p className="text-slate-400 mt-2">管理您的帳戶設定</p>
      </div>

      {searchParams.error && (
        <div className="mb-6 rounded-md bg-red-500/15 p-4 text-sm text-red-400 border border-red-500/30">
          {searchParams.error}
        </div>
      )}
      {searchParams.success && (
        <div className="mb-6 rounded-md bg-emerald-500/15 p-4 text-sm text-emerald-400 border border-emerald-500/30">
          {searchParams.success}
        </div>
      )}
      {searchParams.info && (
        <div className="mb-6 rounded-md bg-cyber-cyan-500/15 p-4 text-sm text-cyber-cyan-400 border border-cyber-cyan-500/30">
          {searchParams.info}
        </div>
      )}

      <div className="grid gap-6">
        <Card className="border-white/10 bg-slate-800/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white">帳戶資訊</CardTitle>
            <CardDescription className="text-slate-400">
              管理您的帳戶基本資訊
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateCompany} className="space-y-4">
              <input type="hidden" name="companyId" value={company.id} />
              <div className="space-y-2">
                <Label htmlFor="company-name" className="text-slate-300">
                  帳戶名稱
                </Label>
                <Input
                  id="company-name"
                  name="companyName"
                  defaultValue={company.name}
                  placeholder="請輸入帳戶名稱"
                  required
                  className="bg-slate-700/50 border-white/10 text-white placeholder:text-slate-500"
                />
              </div>
              <Button type="submit">儲存變更</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
