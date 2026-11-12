# E-mails de autenticação — 26fit • Central Comercial

## Situação atual

- O nome de aplicação configurado no Neon Auth é **26fit • Central Comercial**.
- Template pronto em \`lib/emails/central-auth.js\`, com textos em português, logo e marca 26fit, assunto e visual responsivo.
- Prévia somente para a gestão autenticada em \`/api/email-preview?type=otp\` e em \`?type=verification\`, \`?type=reset\`, \`?type=link\`.
- Integração opcional em \`/api/neon-email\`, **não ativada**. O Neon continua enviando os e-mails originais até configurar o serviço externo.

## Ativação segura

1. Configurar um domínio remetente verificado no Resend (SPF/DKIM/DNS).
2. Adicionar à Vercel, em Production, as variáveis seguras:
   - \`RESEND_API_KEY\`: chave com permissão de envio do Resend.
   - \`AUTH_EMAIL_FROM\`: remetente verificado, exemplo \`26fit Central Comercial <acesso@dominio-verificado.com.br>\`.
3. Fazer deploy e verificar a rota de prévia autenticada.
4. Testar a entrega com o domínio e a chave configurados **antes** de mudar o Neon.
5. No Neon Console, no projeto da Central Comercial, abrir Auth > Configuration > Webhooks:
   - URL: \`https://centralcomercial-eta.vercel.app/api/neon-email\`
   - Eventos: \`send.otp\` e \`send.magic_link\`
   - Timeout: até 10 segundos
   - Ativar somente após confirmar a entrega do provedor.
6. Realizar um login real e uma recuperação de senha para validar a ponta a ponta.

## Segurança

- Assinatura Ed25519 do Neon validada com chave pública JWKS; timestamp limitado a 5 minutos.
- O código e os links recebidos **não são gravados em banco nem em logs**.
- Idempotência no Resend por \`event_id\`, para reduzir envios duplicados.
- Em caso de falha do provedor, retorna erro (não afirma entrega).
- Não registre webhooks \`send.otp\` e \`send.magic_link\` antes do provedor estar pronto: **a ativação substitui o e-mail padrão do Neon** e pode interromper o login se o remetente não estiver configurado.
- A aplicação conserva os convites de equipe e as permissões atuais; esta integração muda somente a entrega dos e-mails de autenticação.
