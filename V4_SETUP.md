# V4 — Banco e Administração Real

A V4 transforma o catálogo e os pedidos em dados persistentes no Supabase.

## O que muda

- Produtos e estoque passam a vir do Supabase.
- Fotos enviadas no painel são armazenadas no bucket `product-images`.
- Checkout cria o pedido no banco antes de abrir o WhatsApp.
- O estoque é reservado na criação do pedido.
- `/admin/pedidos` altera status reais.
- Ao marcar **PRONTO**, o estoque reservado é consumido.
- Se cancelar antes de ficar pronto, a reserva é liberada.
- `/pedido/<token>` acompanha o status em tempo quase real.

## Passos de conexão

1. Crie um NOVO projeto Supabase para esta conveniência. Não use o banco do outro sistema.
2. No SQL Editor do projeto novo, execute `supabase/V4_INSTALL.sql` uma única vez.
3. Em Authentication > Users, crie o usuário administrativo com e-mail e senha.
4. No SQL Editor, dê perfil de administrador substituindo o e-mail abaixo:

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where email = 'SEU_EMAIL_AQUI';
```

5. Copie no Supabase:
   - Project URL
   - Publishable key
   - Secret key
6. Na Vercel > Project > Settings > Environment Variables, crie:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
NEXT_PUBLIC_STORE_SLUG=piedade
NEXT_PUBLIC_STORE_WHATSAPP=5581995568320
NEXT_PUBLIC_DELIVERY_FEE=7
NEXT_PUBLIC_DEFAULT_CITY=Jaboatão dos Guararapes
NEXT_PUBLIC_DEFAULT_STATE=PE
```

7. Faça Redeploy na Vercel.
8. Entre em `/login` com o usuário administrador.

## Segurança

A `SUPABASE_SECRET_KEY` deve existir apenas na Vercel/servidor. Nunca coloque essa chave em variável iniciada com `NEXT_PUBLIC_` e nunca faça commit dela no GitHub.
