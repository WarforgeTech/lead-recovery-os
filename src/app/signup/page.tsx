import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { Card } from "@/components/ui";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 py-12">
      <Card className="w-full max-w-md">
        <Link href="/" className="text-sm font-medium text-zinc-600 hover:text-zinc-950">
          Pipeline Recovery OS
        </Link>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight text-zinc-950">Start your recovery queue</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Use the email you want tied to your workspace. For this demo, no password or email verification is required.
          After signup, the first step is importing your inactive lead file.
        </p>
        <div className="mt-6">
          <SignupForm />
        </div>
        <p className="mt-5 text-sm text-zinc-500">
          Already have a demo workspace? <Link className="font-medium text-zinc-900" href="/login">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
