import { AuthHero } from "@/components/auth-hero";
import { getManagers } from "@/lib/data";
import { SignupForm } from "./signup-form";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  const managers = await getManagers();
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <AuthHero />
      <section className="flex items-center justify-center bg-surface p-6 sm:p-12">
        <SignupForm managers={managers} />
      </section>
    </main>
  );
}
