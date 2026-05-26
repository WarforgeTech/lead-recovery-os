import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <Card className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          Pipeline Recovery OS
        </Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">Client login</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Enter the email Mark invited. You will receive a secure magic link. No password is required.
        </p>
        <div className="mt-6">
          <LoginForm />
        </div>
      </Card>
    </main>
  );
}
