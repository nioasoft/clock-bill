import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { Highlights } from "@/components/landing/highlights";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FAQ } from "@/components/landing/faq";
import { CTASection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/footer";

export default async function Home() {
  // Redirect authenticated users straight to the dashboard. Reads the real
  // Better Auth session (the old code checked an obsolete "session" cookie that
  // no longer exists, so logged-in users wrongly saw the marketing landing).
  const user = await getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <>
      <LandingNavbar />
      <Hero />
      <HowItWorks />
      <FeaturesGrid />
      <Highlights />
      <FAQ />
      <CTASection />
      <LandingFooter />
    </>
  );
}
