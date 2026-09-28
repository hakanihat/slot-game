import { AppError } from '../application/errors.js';
import type { Wallet } from '../application/ports.js';

export interface LedgerEntry {
  readonly type: 'open' | 'debit' | 'credit';
  readonly amount: number;
  readonly reference: string;
  readonly balanceAfter: number;
}

interface Account {
  balance: number;
  readonly ledger: LedgerEntry[];
}

const MAX_LEDGER_ENTRIES = 500;

/** Demo wallet with an append-only (bounded) ledger per account for auditability. */
export class InMemoryWallet implements Wallet {
  private readonly accounts = new Map<string, Account>();

  async open(accountId: string, initialBalance: number): Promise<void> {
    const account: Account = { balance: 0, ledger: [] };
    this.accounts.set(accountId, account);
    this.record(account, 'open', initialBalance, 'open');
  }

  async balance(accountId: string): Promise<number> {
    return this.account(accountId).balance;
  }

  async debit(accountId: string, amount: number, reference: string): Promise<number> {
    assertAmount(amount);
    const account = this.account(accountId);
    if (account.balance < amount) {
      throw new AppError('INSUFFICIENT_FUNDS', 'Balance is too low for this bet');
    }
    return this.record(account, 'debit', -amount, reference);
  }

  async credit(accountId: string, amount: number, reference: string): Promise<number> {
    assertAmount(amount);
    return this.record(this.account(accountId), 'credit', amount, reference);
  }

  async close(accountId: string): Promise<void> {
    this.accounts.delete(accountId);
  }

  ledger(accountId: string): readonly LedgerEntry[] {
    return this.account(accountId).ledger;
  }

  private record(
    account: Account,
    type: LedgerEntry['type'],
    delta: number,
    reference: string,
  ): number {
    account.balance += delta;
    account.ledger.push({
      type,
      amount: Math.abs(delta),
      reference,
      balanceAfter: account.balance,
    });
    if (account.ledger.length > MAX_LEDGER_ENTRIES) account.ledger.shift();
    return account.balance;
  }

  private account(accountId: string): Account {
    const account = this.accounts.get(accountId);
    if (!account) throw new AppError('NOT_FOUND', 'Wallet account not found');
    return account;
  }
}

function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new RangeError(`Wallet amounts must be non-negative integers, got ${amount}`);
  }
}
