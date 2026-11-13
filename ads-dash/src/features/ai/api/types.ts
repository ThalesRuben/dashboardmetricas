// Tipos públicos da feature `ai` — diretriz/cérebro da marca.

export interface AiBrain {
  norte: string;
  publico_alvo: string;
  tom_de_voz: string;
  ofertas_atuais: string;
  diferenciais: string;
  evitar: string;
  palavras_chave: string;
  // Toggle do cron de reativação: quando false, o coach-reactivation-cron
  // aborta sem gerar rascunhos. Serve como "panic-off" sem precisar deployar.
  reativacao_auto_ativa?: boolean;
}
