import { useState, useEffect, useCallback, useRef, startTransition } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { inventoryAPI } from "../services/inventory";
import type { InventoryItem } from "../services/inventory";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Inventory.css";

const CATEGORIES = ["all", "weapon", "armor", "medical", "drug", "material", "other"];

export default function Inventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState("all");
  const [actionItem, setActionItem] = useState<InventoryItem | null>(null);
  const [actionType, setActionType] = useState<"use" | "drop" | null>(null);
  const [actionQty, setActionQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null);
    setLoading(true);
    inventoryAPI.getInventory({ page, category: category === "all" ? undefined : category })
      .then((res) => { setItems(res.data); setTotal(res.total); })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load inventory";
        setError(msg); toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [page, category]);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  useEffect(() => { startTransition(() => { setPage(1); }); }, [category]);

  const handleUse = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      const res = await inventoryAPI.useItem(actionItem.item_id, actionQty);
      toast.success(`Used ${actionQty}x ${actionItem.item_name}`);
      if (res.effects) userEvents.emit(res.effects);
      setActionItem(null); setActionType(null);
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to use item");
    } finally { setSubmitting(false); }
  };

  const handleDrop = async () => {
    if (!actionItem) return;
    setSubmitting(true);
    try {
      await inventoryAPI.dropItem(actionItem.item_id, actionQty);
      toast.success(`Dropped ${actionQty}x ${actionItem.item_name}`);
      setActionItem(null); setActionType(null);
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to drop item");
    } finally { setSubmitting(false); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <Shell>
      <div className="inv-container">
        <div className="inv-header">
          <h1 className="inv-title"><Icon name="inventory" size={26} className="icon-accent" /> Inventory</h1>
          <span className="inv-count">{total} items</span>
        </div>

        <div className="inv-categories">
          {CATEGORIES.map((c) => (
            <button key={c} className={`inv-cat-btn ${category === c ? "active" : ""}`} onClick={() => setCategory(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="inv-skeleton"><Skeleton width={300} height={4} /></div>
        ) : error ? (
          <div className="inv-error" role="alert"><p>{error}</p><button className="inv-retry-btn" onClick={load}>Retry</button></div>
        ) : items.length === 0 ? (
          <p className="inv-empty">Your inventory is empty. Visit the Black Market to buy items.</p>
        ) : (
          <>
            <div className="inv-grid">
              {items.map((item) => (
                <div key={item.id} className="inv-card">
                  <div className="inv-card-header">
                    <span className="inv-item-name">{item.item_name}</span>
                    <span className={`inv-item-category inv-cat-${item.item_category}`}>{item.item_category}</span>
                  </div>
                  <p className="inv-item-desc">{item.item_description}</p>
                  <div className="inv-card-footer">
                    <span className="inv-item-qty">x{item.quantity}</span>
                    <div className="inv-actions">
                      {item.item_usable && (
                        <button className="inv-use-btn" onClick={() => { setActionItem(item); setActionType("use"); setActionQty(1); }}>
                          Use
                        </button>
                      )}
                      {(item.item_category === "other" || !item.item_usable) && (
                        <button className="inv-drop-btn" onClick={() => { setActionItem(item); setActionType("drop"); setActionQty(1); }}>
                          Drop
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="inv-pagination">
                <button className="inv-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                <span className="inv-page-info">Page {page} of {totalPages}</span>
                <button className="inv-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            )}
          </>
        )}
      </div>

      <Modal isOpen={!!actionItem} onClose={() => { if (!submitting) { setActionItem(null); setActionType(null); } }}
        title={actionType === "use" ? "Use Item" : "Drop Item"} titleId="inv-action-title">
        {actionItem && (
          <div className="inv-action-modal">
            <p className="inv-action-text">
              {actionType === "use" ? "Use" : "Drop"} <strong>{actionItem.item_name}</strong>
            </p>
            <div className="inv-input-group">
              <label className="inv-label">Quantity (max: {actionItem.quantity})</label>
              <input className="inv-input" type="number" min={1} max={actionItem.quantity}
                value={actionQty} onChange={(e) => setActionQty(Math.min(Math.max(1, parseInt(e.target.value) || 1), actionItem.quantity))}
              />
            </div>
            <button className={`inv-confirm-btn ${actionType === "use" ? "inv-confirm-use" : "inv-confirm-drop"}`}
              disabled={submitting} onClick={() => { if (actionType === "use") void handleUse(); else void handleDrop(); }}>
              {submitting ? "Processing..." : actionType === "use" ? "Use" : "Drop"}
            </button>
          </div>
        )}
      </Modal>
    </Shell>
  );
}
