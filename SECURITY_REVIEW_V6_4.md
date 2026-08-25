# Resumo de segurança — V6.4

Implementado no código:

- [x] Rate limit persistente para criação de pedido
- [x] Rate limit para consulta de tracking
- [x] Idempotência do checkout
- [x] Reserva com expiração de 15 minutos
- [x] Validação de tamanho do JSON
- [x] Limites de campos, itens e quantidades
- [x] Validação de origem nas mutações
- [x] Tracking sem telefone/endereço
- [x] Fallback do WhatsApp não grava mais nome/endereço/telefone no localStorage
- [x] API pública sem `on_hand`, `reserved` ou UUID interno do estoque
- [x] Estoque de produto existente não pode ser alterado pela API de Produtos
- [x] Upload validado por assinatura JPEG/PNG/WebP
- [x] Headers de segurança
- [x] Policies de escrita direta removidas pela migration
- [x] Leitura pública direta de `inventory` removida pela migration
- [x] Limpeza da tabela de rate limit

Configuração manual recomendada:

- [ ] Leaked Password Protection no Supabase Auth
- [ ] Desativar cadastro público de usuários
- [ ] Senha administrativa longa e exclusiva
- [ ] MFA na conta Supabase/GitHub
- [ ] Tornar o GitHub privado
- [ ] Atualizar Next.js para o patch de segurança de 26/08/2026 assim que disponível
