import Main from "@/components/main";
import { Showcase } from "@/components/showcase";
import Features from "@/components/feature-section";
import Footer from "@/components/footer";
import { Header } from "@/components/header";
import CallToAction from "@/components/calltoaction";

export default function Page() {
  return (
    <div className="flex flex-col min-h-screen overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
      <Header />
      <main className="flex-1">
        <Main />
      </main>
      <Showcase />
      <Features />
      <CallToAction />
      <Footer />
    </div>
  );
}
