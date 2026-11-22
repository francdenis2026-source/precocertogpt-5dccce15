import { MessageCircle } from "lucide-react";

const WHATSAPP_HREF = `https://wa.me/5568992031340?text=${encodeURIComponent("Olá! Vi o PreçoCerto e gostaria de falar com o desenvolvedor.")}`;

export function DeveloperContact() {
  return (
    <aside className="ph-wrap ph-dev" aria-label="Contato com o desenvolvedor">
      <p>Desenvolvido por <strong>Franc D'nis</strong>. Dúvidas, sugestões ou parcerias?</p>
      <a href={WHATSAPP_HREF} target="_blank" rel="noopener noreferrer">
        <MessageCircle aria-hidden="true" /> (68) 99203-1340
      </a>
    </aside>
  );
}
