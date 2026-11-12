# Agenda e lembretes da Central Comercial

- Compromissos e participantes ficam no Neon (tabelas cc_calendar_events, cc_calendar_attendees e cc_calendar_audit).
- Prazos das demandas editadas são espelhados como eventos de agenda. O restante do conteúdo das demandas continua apenas no navegador, até migração.
- A rotina Vercel Cron roda uma vez por dia, às 12h UTC (aprox. 9h de Brasília), buscando compromissos de hoje e de amanhã.
- O e-mail é enviado apenas à pessoa organizadora e aos participantes selecionados com contas ativas. Suspensos não são notificados.
- O envio usa Resend com idempotência e registro por evento, destinatário, tipo e versão.
- **Envios inativos por padrão.** Para ativar, cadastre no projeto Vercel Production:
  1. RESEND_API_KEY (credencial secreta);
  2. AUTH_EMAIL_FROM (endereço de domínio verificado, com SPF e DKIM);
  3. CRON_SECRET (valor secreto aleatório de pelo menos 32 bytes).
- Enquanto faltar alguma configuração, o endpoint informa \`active:false\` sem enviar. A interface nunca afirma que os e-mails foram enviados.
- Os avisos agendados cobrem hoje e amanhã no horário do cron. Eventos registrados depois da execução diária precisam de nova execução para e-mail no mesmo dia. Avisos visuais na aplicação independem do provedor.
- Nunca coloque credenciais no repositório ou no chat; cadastre diretamente em Environment Variables na Vercel.
- Testes necessários: novo evento com convidado real, convite com conta ativa, aviso com domínio verificado, evento cancelado, evento concluído, usuário suspenso e duplicidade de cron.
