export interface ConfirmedMemberDetailsInput {
  hasBurningManTicket?: boolean;
  hasVehiclePass?: boolean;
  requests?: string;
  // Backward compatibility for previously saved field name.
  notes?: string;
}

export interface NormalizedConfirmedMemberDetails {
  hasBurningManTicket: boolean;
  hasVehiclePass: boolean;
  requests?: string;
  notes?: string;
}

export function normalizeConfirmedMemberDetails(
  input: ConfirmedMemberDetailsInput
): NormalizedConfirmedMemberDetails {
  const rawRequests = input.requests ?? input.notes;
  const trimmedRequests = rawRequests?.trim();

  return {
    hasBurningManTicket: input.hasBurningManTicket ?? false,
    hasVehiclePass: input.hasVehiclePass ?? false,
    requests: trimmedRequests ? trimmedRequests : undefined,
    // Keep writing legacy field for backwards compatibility during rename.
    notes: trimmedRequests ? trimmedRequests : undefined,
  };
}
