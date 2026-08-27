# V6.8.2 — Validação Inteligente de Endereço

## Objetivo
Corrigir falsos bloqueios no checkout quando o CEP é válido, mas o geocodificador não conhece exatamente o número da residência.

## O que mudou
- Consulta automática do CEP em **BrasilAPI** e fallback em **ViaCEP**.
- Preenchimento/conferência automática de rua, bairro, cidade e UF quando o CEP é localizado.
- O servidor continua recalculando tudo no momento de criar o pedido; o navegador não define o frete.
- Geocodificação em cascata:
  1. rua + número + bairro + cidade + UF + CEP;
  2. rua + bairro + cidade + UF + CEP;
  3. coordenada aproximada do CEP (quando disponível) ou busca pelo CEP.
- Quando o número exato não for encontrado, o checkout pode aceitar uma localização aproximada e avisa o cliente para conferir número, complemento e referência.
- O limite máximo de entrega e as faixas de frete continuam sendo aplicados pela distância calculada no servidor.
- O fallback por zonas de entrega continua existindo caso zonas sejam configuradas futuramente.

## Instalação
Esta versão **não exige SQL novo**.

1. Substitua os arquivos da V6.8.1 pelos arquivos deste pacote.
2. Faça commit e push no GitHub.
3. Aguarde a Vercel finalizar o deploy.
4. Teste CEPs reais antes usados no checkout.

## Testes recomendados
1. CEP conhecido + rua/número existentes: deve localizar e calcular normalmente.
2. CEP válido em que o mapa não conhece o número: deve tentar a rua e mostrar aviso de localização aproximada.
3. CEP inválido: não deve inventar endereço; o cliente deverá conferir os dados.
4. Endereço acima de 10 km: deve continuar bloqueado.
5. Pedido acima de R$ 50: frete grátis continua ativo, mas a distância ainda deve ser validada.
6. Alterar manualmente cidade/UF depois do CEP: a consulta do CEP deve corrigir para os dados oficiais quando disponíveis.
7. Testar o CEP 54330835 / Rua Nossa Senhora Aparecida, Cajueiro Seco, como caso de regressão.

## Observação de produção
BrasilAPI, ViaCEP, Nominatim e OSRM são serviços externos. A V6.8.2 usa redundância para reduzir falhas, mas para alto volume comercial ainda é recomendável migrar geocodificação/roteamento para um provedor gerenciado mantendo a mesma interface do servidor.
