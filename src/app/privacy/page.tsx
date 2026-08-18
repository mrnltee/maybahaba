import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Notice — MayBahaBa",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl flex-1 px-4 py-12 sm:px-6">
      <Link href="/" className="text-sm text-(--color-brand) hover:underline">
        ← Balik sa MayBahaBa
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-(--color-ink)">Privacy Notice</h1>

      <div className="prose prose-sm mt-6 max-w-none space-y-4 text-sm leading-relaxed text-(--color-ink-muted)">
        <p>
          Layunin ng MayBahaBa na maging kapaki-pakinabang para sa mga motorista habang kinokolekta
          lamang ang pinakakailangang impormasyon.
        </p>
        <p>
          <strong className="text-(--color-ink)">Hindi kailangan ng account.</strong> Puwede kang
          mag-submit ng report ng baha nang hindi nagpapa-rehistro. Optional lang ang pangalan o
          nickname — puwede kang mag-post nang anonymous.
        </p>
        <p>
          <strong className="text-(--color-ink)">Lokasyon.</strong> Kung gagamit ka ng &quot;Use My
          Location&quot;, minsan lang hihilingin ang access sa iyong device location — hindi ito
          patuloy na tinatrack.
        </p>
        <p>
          <strong className="text-(--color-ink)">Abuse prevention.</strong> Para maiwasan ang
          spam/abuse, ginagamit namin ang hashed na bersyon (hindi ang raw IP address) ng iyong
          koneksyon para sa rate limiting. Hindi namin ipinapakita ang IP address kahit kanino.
        </p>
        <p>
          <strong className="text-(--color-ink)">Mga report.</strong> Ang mga isinumiteng report
          (lokasyon, oras, antas ng baha, at optional na detalye) ay nakikita ng publiko dahil ito
          ang layunin ng platform — tumulong sa ibang motorista. Iwasan ang paglagay ng personal na
          impormasyon maliban na lang kung gusto mong lumabas ito nang pampubliko.
        </p>
        <p>
          MayBahaBa ay isang community-run na proyekto, hindi ito opisyal na serbisyo ng
          gobyerno.
        </p>
      </div>
    </main>
  );
}
