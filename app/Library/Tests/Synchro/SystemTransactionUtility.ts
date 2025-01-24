/**
 * @file SystemTransactionUtility.ts
 * @description
 * Provides a utility function to execute system-level operations within Y.js transactions,
 * marking them with a distinct origin for filtering purposes.
 */

import * as Y from 'yjs';
import { SystemOrigin, SystemActionType } from './Centralize/SystemOriginTypes';

/**
 * Executes a system-level operation within a Y.js transaction.
 *
 * @param ydoc - The Y.Doc instance on which the transaction is executed.
 * @param action - The system operation to perform.
 * @param systemAction - The specific type of system action being performed.
 * @param options - Optional transaction configurations.
 * @returns The result of the executed action.
 */
export const systemTransaction = <T>(
  ydoc: Y.Doc,
  action: () => T,
  systemAction: SystemActionType,
  options: { atomic?: boolean; description?: string } = {}
): T => {
  const transactionId = crypto.randomUUID();

  return ydoc.transact(() => {
    return action();
  }, {
    type: 'system',
    action: systemAction,
    transactionId
  } as SystemOrigin);
};
