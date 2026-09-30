import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "Daftar — UnitKu" };

export default function RegisterPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#f8fafc] px-4 py-8">
      <Suspense fallback={null}>
        <AuthForm initialMode="register" />
      </Suspense>
      <p className="mt-6 text-center text-[12.5px] text-zinc-400">
        UnitKu — SaaS Manajemen Properti Sewa
      </p>
    </div>
  );
}
