# Conveniência 24h — V6.4 Security Hardening

Esta versão mantém o visual e as funções da V6.3 e reforça a segurança antes da abertura ao público.

## Ordem correta para atualizar

### 1. Supabase — rode a migration primeiro
No projeto **Conveniência-24h**, abra **SQL Editor** e execute o conteúdo completo de:

`supabase/V6_4_SECURITY_HARDENING.sql`

A migration:
- adiciona idempotência aos pedidos;
- cria expiração automática da reserva após 15 minutos se o pedido continuar em `received`;
- cria rate limit persistente no banco;
- remove permissões de escrita direta do painel pelo cliente Supabase;
- remove leitura pública direta dos campos internos de estoque;
- restringe uploads a JPEG, PNG e WebP;
- cria as RPCs `create_order_v64`, `expire_stale_orders_v64`, `check_rate_limit_v64` e `set_order_status_v64`.

> Importante: faça este SQL **antes** de publicar o código V6.4. A rota de pedidos V6.4 depende dessas novas funções.

### 2. Supabase Auth — duas configurações manuais recomendadas
Em **Authentication**:

1. Desative cadastro público de novos usuários se somente a equipe interna terá login.
2. Em Password Security, habilite **Leaked Password Protection** se estiver disponível no seu plano.

Use uma senha administrativa longa, exclusiva e que não seja reutilizada em outros sites.

### 3. Vercel
As mesmas variáveis já configuradas continuam valendo. A V6.4 não exige nova chave:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- variáveis `NEXT_PUBLIC_STORE_*`

A `SUPABASE_SECRET_KEY` deve continuar marcada como Sensitive e nunca pode começar com `NEXT_PUBLIC_`.

### 4. Publicação
Substitua os arquivos do repositório pelos da V6.4, faça Commit + Push e aguarde a Vercel ficar `Ready`.

Se fizer Redeploy manual, deixe **Use existing Build Cache** desmarcado.

## Teste rápido obrigatório depois do deploy

1. Abra a loja e confirme que produtos carregam.
2. Faça um pedido de teste.
3. Confira se ele aparece no painel.
4. Passe para `Em separação` e depois `Pronto`.
5. Confirme que o estoque baixa apenas ao passar para `Pronto`.
6. Faça outro pedido e deixe em `Recebido`; após 15 minutos, abra/atualize a loja ou o painel e confirme que a reserva expira e o saldo volta a ficar disponível.
7. Abra `/api/admin/inventory` sem estar logado: deve retornar `401`.
8. Teste upload de JPG/PNG/WebP; outros formatos devem ser recusados.

## O que a V6.4 protege

### Pedidos falsos / spam
A criação de pedidos tem limite por impressão técnica de IP + navegador, armazenada apenas como hash HMAC. O limite padrão é 6 tentativas em 10 minutos; excesso bloqueia por 30 minutos.

### Clique duplo / repetição de rede
O checkout envia um `client_order_key`. Se o navegador repetir a mesma criação, o banco devolve o pedido já criado em vez de reservar estoque novamente.

### Estoque preso
Pedidos que continuarem em `received` por 15 minutos são cancelados automaticamente e a reserva é liberada. A limpeza ocorre de forma oportunística quando a loja/painel é acessado, sem depender de cron pago.

### Dados de acompanhamento
A rota pública de tracking não devolve telefone nem endereço completo e usa somente o primeiro nome do cliente.

### Escrita administrativa
Produtos, pedidos e estoque são alterados apenas pelas rotas do servidor autenticadas; as policies de escrita direta do Supabase foram removidas.

### Upload
O backend confere a assinatura real do arquivo, não apenas o nome/extensão, e aceita somente JPEG, PNG e WebP até 5 MB.

### Headers
Foram adicionados CSP básica, proteção contra iframe, `nosniff`, política de referrer e restrições de câmera/microfone/geolocalização.

## Pendência planejada

A V6.4 mantém o Next.js 16.3.2 para não alterar a stack antes do patch anunciado para 26/08/2026. Assim que o patch da série 16.3 for publicado, atualizar o Next.js deve ser tratado como prioridade antes da divulgação ampla da loja.

Também é recomendado tornar o repositório GitHub privado antes do lançamento comercial.
