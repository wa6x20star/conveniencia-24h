export function cancellationError(code: string) {
  const messages: Record<string, string> = {
    cancellation_reason_required: "Informe um motivo de 3 a 300 caracteres.",
    cannot_cancel_delivered: "Entrega já confirmada. Este pedido não pode ser cancelado.",
    cannot_cancel_paid_delivery: "Já existe repasse para esta entrega. Revise o financeiro.",
    stock_return_confirmation_required: "Confirme o retorno dos produtos à loja antes de cancelar.",
    stock_release_failed: "Reserva inconsistente. Nada foi alterado; confira o estoque.",
    stock_recovery_failed: "Estoque não localizado. Nada foi alterado; confira o cadastro.",
    stock_product_missing: "Há um produto removido neste pedido. Revise o estoque antes de cancelar.",
    order_is_final: "O pedido já foi encerrado. Atualize a página.",
    refund_not_pending: "Este pedido não tem estorno pendente.",
    refund_reference_required: "Informe a referência da devolução já realizada (3 a 300 caracteres).",
    invalid_transition: "O status mudou. Atualize a página e tente novamente.",
  };
  return messages[code] || "Não foi possível concluir. Atualize a página; se persistir, confira a instalação da V6.8.4.";
}
