import Link from "next/link";

const eventName = process.env.NEXT_PUBLIC_EVENT_NAME || "Aniversário";

const links = [
  {
    href: "/upload",
    emoji: "📸",
    title: "Enviar Foto",
    description: "Página que os convidados abrem ao escanear o QR Code.",
  },
  {
    href: "/telao",
    emoji: "🖥️",
    title: "Ver Telão",
    description: "Abra em tela cheia no computador ligado à TV/projetor.",
  },
  {
    href: "/album",
    emoji: "🖼️",
    title: "Álbum Completo",
    description: "Todas as fotos do evento, para a aniversariante rever depois.",
  },
  {
    href: "/qr",
    emoji: "🔗",
    title: "Gerar QR Code",
    description: "Página para imprimir ou exibir o QR Code de acesso.",
  },
];

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center gap-10">
      <div className="space-y-3">
        <p className="text-accent-3 tracking-widest uppercase text-sm font-semibold">
          Mural de Fotos
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-accent via-accent-2 to-accent-3 bg-clip-text text-transparent">
          {eventName}
        </h1>
        <p className="text-foreground/70 max-w-md mx-auto">
          Escolha uma das telas abaixo para configurar o mural de fotos do evento.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors p-6 text-left flex flex-col gap-2"
          >
            <span className="text-3xl">{link.emoji}</span>
            <span className="text-lg font-semibold">{link.title}</span>
            <span className="text-sm text-foreground/60">{link.description}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
