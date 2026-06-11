import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { bankAPI } from "../services/bank";
import type { BankBalance, BankTransaction } from "../services/bank";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Bank.css";

type Tab = "balance" | "deposit" | "withdraw" | "transfer" | "history";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const TX_LABELS: Record<string, string> = {
  deposit: "Deposit", withdraw: "Withdraw", transfer_in: "Transfer In",
  transfer_out: "Transfer Out", crime_reward: "Crime Reward", crime_penalty: "Crime Penalty",
  market_sale: "Market Sale", market_purchase: "Market Purchase",
  referral_bonus: "Referral Bonus", admin_adjust: "Admin Adjust", item_use: "Item Use", tax: "Tax",
};

export default function Bank() {
  const [tab, setTab] = useState<Tab>("balance");
  const [balance, setBalance] = useState<BankBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [transferUsername, setTransferUsername] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [history, setHistory] = useState<BankTransaction[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [confirmTx, setConfirmTx] = useState<{ type: string; label: string; amount: number; username?: string } | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const loadBalance = useCallback(() => {
    setError(null);
    setLoading(true);
    bankAPI.getBalance()
      .then(setBalance)
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load balance";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = loadBalance; }, [loadBalance]);
  useEffect(() => { loadRef.current(); }, []);

  const loadHistoryRef = useRef<(p: number) => void>(() => {});
  const loadHistory = useCallback((page: number) => {
    setHistoryLoading(true);
    bankAPI.getHistory(page)
      .then((res) => {
        setHistory(res.data);
        setHistoryTotal(res.total);
        setHistoryPage(page);
      })
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setHistoryLoading(false));
  }, []);
  useEffect(() => { loadHistoryRef.current = loadHistory; }, [loadHistory]);

  useEffect(() => {
    if (tab === "history") { loadHistoryRef.current(1); }
  }, [tab]);

  const handleDeposit = async () => {
    const amount = parseInt(depositAmount, 10);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      const res = await bankAPI.deposit(amount);
      setBalance((prev) => prev ? { ...prev, money: res.user.money, points: res.user.points } : prev);
      setDepositAmount("");
      toast.success(`Deposited ${formatMoney(amount)}`);
      userEvents.emit({ money: res.user.money });
      setConfirmTx(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Deposit failed");
    } finally { setSubmitting(false); }
  };

  const handleWithdraw = async () => {
    const amount = parseInt(withdrawAmount, 10);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    setSubmitting(true);
    try {
      const res = await bankAPI.withdraw(amount);
      setBalance((prev) => prev ? { ...prev, money: res.user.money, points: res.user.points } : prev);
      setWithdrawAmount("");
      toast.success(`Withdrew ${formatMoney(amount)}`);
      userEvents.emit({ money: res.user.money });
      setConfirmTx(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Withdrawal failed");
    } finally { setSubmitting(false); }
  };

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount, 10);
    if (isNaN(amount) || amount <= 0) { toast.error("Enter a valid amount"); return; }
    if (!transferUsername.trim()) { toast.error("Enter a username"); return; }
    setSubmitting(true);
    try {
      const res = await bankAPI.transfer(transferUsername.trim(), amount);
      setBalance((prev) => prev ? { ...prev, money: res.sender.money, points: res.sender.points } : prev);
      setTransferUsername("");
      setTransferAmount("");
      toast.success(`Transferred ${formatMoney(amount - res.taxPaid)} to ${res.recipient.username}`);
      userEvents.emit({ money: res.sender.money });
      setConfirmTx(null);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transfer failed");
    } finally { setSubmitting(false); }
  };

  const totalPages = Math.ceil(historyTotal / 20);

  if (loading) {
    return (
      <Shell>
        <div className="bank-container">
          <div className="bank-header"><h1 className="bank-title"><Icon name="bank" size={28} className="icon-accent" /> Bank</h1></div>
          <div className="bank-balance-card"><Skeleton width={200} height={4} /></div>
        </div>
      </Shell>
    );
  }

  if (error) {
    return (
      <Shell>
        <div className="bank-error" role="alert">
          <p>{error}</p>
          <button className="bank-retry-btn" onClick={loadBalance}>Retry</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="bank-container">
        <div className="bank-header">
          <h1 className="bank-title"><Icon name="bank" size={26} className="icon-accent" /> Bank of Undercity</h1>
        </div>

        {balance && (
          <div className="bank-balance-card">
            <div className="bank-balance-row">
              <span className="bank-balance-label">Cash on Hand</span>
              <span className="bank-balance-value">{formatMoney(balance.money)}</span>
            </div>
          </div>
        )}

        <div className="bank-tabs">
          {(["balance", "deposit", "withdraw", "transfer", "history"] as Tab[]).map((t) => (
            <button key={t} className={`bank-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
              {t === "balance" && <Icon name="bank" size={14} />}
              {t === "deposit" && <Icon name="deposit" size={14} />}
              {t === "withdraw" && <Icon name="withdraw" size={14} />}
              {t === "transfer" && <Icon name="transfer" size={14} />}
              {t === "history" && <Icon name="history" size={14} />}
              <span>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          ))}
        </div>

        <div className="bank-content">
          {tab === "deposit" && (
            <div className="bank-form">
              <p className="bank-form-desc">Deposit cash into your bank account for safe keeping.</p>
              <div className="bank-input-group">
                <label className="bank-label">Amount ($)</label>
                <input
                  className="bank-input" type="number" min="1" placeholder="1000"
                  value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && depositAmount) setConfirmTx({ type: "deposit", label: "Deposit", amount: parseInt(depositAmount, 10) }); }}
                />
              </div>
              <button
                className="bank-submit-btn"
                disabled={!depositAmount || parseInt(depositAmount, 10) <= 0 || submitting}
                onClick={() => setConfirmTx({ type: "deposit", label: "Deposit", amount: parseInt(depositAmount, 10) })}
              >
                {submitting ? "Processing..." : "Deposit"}
              </button>
            </div>
          )}

          {tab === "withdraw" && (
            <div className="bank-form">
              <p className="bank-form-desc">Withdraw cash from your bank. Funds are deducted from your balance.</p>
              <div className="bank-input-group">
                <label className="bank-label">Amount ($)</label>
                <input
                  className="bank-input" type="number" min="1" placeholder="500"
                  value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && withdrawAmount) setConfirmTx({ type: "withdraw", label: "Withdraw", amount: parseInt(withdrawAmount, 10) }); }}
                />
              </div>
              <button
                className="bank-submit-btn"
                disabled={!withdrawAmount || parseInt(withdrawAmount, 10) <= 0 || submitting}
                onClick={() => setConfirmTx({ type: "withdraw", label: "Withdraw", amount: parseInt(withdrawAmount, 10) })}
              >
                {submitting ? "Processing..." : "Withdraw"}
              </button>
            </div>
          )}

          {tab === "transfer" && (
            <div className="bank-form">
              <p className="bank-form-desc">Transfer money to another player. A 5% tax applies.</p>
              <div className="bank-input-group">
                <label className="bank-label">Recipient Username</label>
                <input
                  className="bank-input" type="text" placeholder="Player name"
                  value={transferUsername} onChange={(e) => setTransferUsername(e.target.value)}
                />
              </div>
              <div className="bank-input-group">
                <label className="bank-label">Amount ($)</label>
                <input
                  className="bank-input" type="number" min="1" placeholder="1000"
                  value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && transferAmount && transferUsername) setConfirmTx({ type: "transfer", label: "Transfer", amount: parseInt(transferAmount, 10), username: transferUsername }); }}
                />
              </div>
              <button
                className="bank-submit-btn"
                disabled={!transferAmount || !transferUsername.trim() || parseInt(transferAmount, 10) <= 0 || submitting}
                onClick={() => setConfirmTx({ type: "transfer", label: "Transfer", amount: parseInt(transferAmount, 10), username: transferUsername })}
              >
                {submitting ? "Processing..." : "Transfer"}
              </button>
            </div>
          )}

          {tab === "history" && (
            <div className="bank-history">
              <h3 className="bank-history-title">Transaction History</h3>
              {historyLoading ? (
                <div className="bank-history-skeleton"><Skeleton width={300} height={4} /></div>
              ) : history.length === 0 ? (
                <p className="bank-empty">No transactions yet.</p>
              ) : (
                <>
                  <div className="bank-history-list">
                    {history.map((tx) => (
                      <div key={tx.id} className="bank-history-row">
                        <div className="bank-history-left">
                          <span className={`bank-history-type bank-history-type-${tx.type}`}>
                            {TX_LABELS[tx.type] ?? tx.type}
                          </span>
                          <span className="bank-history-date">{formatDate(tx.created_at)}</span>
                          {tx.description && <span className="bank-history-desc">{tx.description}</span>}
                        </div>
                        <span className={`bank-history-amount ${tx.amount >= 0 ? "bank-amount-positive" : "bank-amount-negative"}`}>
                          {tx.amount >= 0 ? "+" : ""}{formatMoney(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {totalPages > 1 && (
                    <div className="bank-pagination">
                      <button className="bank-page-btn" disabled={historyPage <= 1} onClick={() => loadHistoryRef.current(historyPage - 1)}>Prev</button>
                      <span className="bank-page-info">Page {historyPage} of {totalPages}</span>
                      <button className="bank-page-btn" disabled={historyPage >= totalPages} onClick={() => loadHistoryRef.current(historyPage + 1)}>Next</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {tab === "balance" && balance && (
            <div className="bank-info">
              <div className="bank-info-card">
                <Icon name="bank" size={24} className="icon-accent" />
                <div className="bank-info-text">
                  <span className="bank-info-label">Available Balance</span>
                  <span className="bank-info-value">{formatMoney(balance.money)}</span>
                </div>
              </div>
              <div className="bank-info-card">
                <Icon name="points" size={24} className="icon-accent" />
                <div className="bank-info-text">
                  <span className="bank-info-label">Honor Points</span>
                  <span className="bank-info-value">{balance.points.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={!!confirmTx} onClose={() => { if (!submitting) setConfirmTx(null); }} title="Confirm Transaction" titleId="confirm-tx-title">
        {confirmTx && (
          <div className="bank-confirm">
            <p className="bank-confirm-text">
              {confirmTx.label} <strong>{formatMoney(confirmTx.amount)}</strong>
              {confirmTx.username ? <> to <strong>{confirmTx.username}</strong></> : ""}?
            </p>
            <div className="bank-confirm-actions">
              <button className="bank-confirm-btn bank-confirm-yes" disabled={submitting} onClick={() => {
                if (confirmTx.type === "deposit") void handleDeposit();
                else if (confirmTx.type === "withdraw") void handleWithdraw();
                else if (confirmTx.type === "transfer") void handleTransfer();
              }}>
                {submitting ? "Processing..." : "Confirm"}
              </button>
              <button className="bank-confirm-btn bank-confirm-no" disabled={submitting} onClick={() => setConfirmTx(null)}>Cancel</button>
            </div>
          </div>
        )}
      </Modal>
    </Shell>
  );
}
