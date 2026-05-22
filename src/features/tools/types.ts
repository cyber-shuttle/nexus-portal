export type CreditTransferResult = {
  transfer_id: string;
  source_allocation_id: string;
  destination_allocation_id: string;
  compute_allocation_resource_id: string;
  su_amount: number;
  transferred_by: string;
  transferred_at: string;
  source_balance_after: number;
  destination_balance_after: number;
};
