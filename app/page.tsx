import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingNavbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FAQ } from "@/components/landing/faq";
import { CTASection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/footer";

export default async function Home() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session");

  if (session?.value) {
    redirect("/dashboard");
  }

  return (
    <>
      <LandingNavbar />
      <Hero />
      <HowItWorks />
      <FeaturesGrid />
      <FAQ />
      <CTASection />
      <LandingFooter />
    </>
  );
}
