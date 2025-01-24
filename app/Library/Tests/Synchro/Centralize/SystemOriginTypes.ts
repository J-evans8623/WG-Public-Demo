/**
 * @file SystemOriginTypes.ts
 * @description
 * Defines types for system-originated transactions to differentiate them from user-initiated updates.
 */

export type SystemActionType = 
  | 'reset' 
  | 'fileLoad' 
  | 'cleanup' 
  | 'initialize'
  | 'documentSwitch';

export interface SystemOrigin {
  type: 'system';
  action: SystemActionType;
  transactionId?: string; // Optional identifier for tracking related operations
}
