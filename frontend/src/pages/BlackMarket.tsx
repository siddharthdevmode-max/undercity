import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { marketAPI } from "../services/market";
import type { MarketListing } from "../services/market";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/BlackMarket.css";

function formatMoney(amount: number): string {
  return `$${amount.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type MarketTab = "browse" | "my-listings";

export default function BlackMarket() {
  const [tab, setTab] = useState<MarketTab>("browse");
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [buying, setBuying] = useState<number | null>(null);

  const [myListings, setMyListings] = useState<MarketListing[]>([]);
  const [myListingsLoading, setMyListingsLoading] = useState(false);
  const [cancelling, setCancelling] = useState<number | null>(null);

  const [listItemId, setListItemId] = useState("");
  const [listQty, setListQty] = useState("1");
  const [listPrice, setListPrice] = useState("");
  const [listingForm, setListingForm] = useState(false);
  const [listingSubmitting, setListingSubmitting] = useState(false);

  const loadRef = useRef<() => void>(() => {});
  const loadListings = useCallback(() => {
    setError(null);
    setLoading(true);
    marketAPI.getListings({ page, q: search || undefined, category: category || undefined, sort: "price", order: "asc" })
      .then((res) => {
        setListings(res.data);
        setTotal(res.total);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : "Failed to load market";
        setError(msg);
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }, [page, search, category]);
  useEffect(() => { loadRef.current = loadListings; }, [loadListings]);
  useEffect(() => { loadRef.current(); }, []);

  const loadMyListingsRef = useRef<() => void>(() => {});
  const loadMyListings = useCallback(() => {
    setMyListingsLoading(true);
    marketAPI.getMyListings()
      .then((res) => setMyListings(res.listings))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Failed to load your listings"))
      .finally(() => setMyListingsLoading(false));
  }, []);
  useEffect(() => { loadMyListingsRef.current = loadMyListings; }, [loadMyListings]);
  useEffect(() => { if (tab === "my-listings") loadMyListingsRef.current(); }, [tab]);

  const handleBuy = async (listingId: number) => {
    setBuying(listingId);
    try {
      const res = await marketAPI.buyItem(listingId);
      toast.success(`Purchased for ${formatMoney(res.totalCost)}`);
      userEvents.emit({});
      loadListings();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally { setBuying(null); }
  };

  const handleCancel = async (listingId: number) => {
    setCancelling(listingId);
    try {
      await marketAPI.cancelListing(listingId);
      toast.success("Listing cancelled, items returned");
      loadMyListingsRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel");
    } finally { setCancelling(null); }
  };

  const handleList = async () => {
    const itemId = parseInt(listItemId, 10);
    const quantity = parseInt(listQty, 10);
    const price = parseInt(listPrice, 10);
    if (isNaN(itemId) || itemId <= 0) { toast.error("Enter a valid item ID"); return; }
    if (isNaN(quantity) || quantity <= 0) { toast.error("Enter a valid quantity"); return; }
    if (isNaN(price) || price <= 0) { toast.error("Enter a valid price"); return; }
    setListingSubmitting(true);
    try {
      await marketAPI.listItem(itemId, quantity, price);
      toast.success("Item listed for sale!");
      setListItemId(""); setListQty("1"); setListPrice("");
      setListingForm(false);
      if (tab === "my-listings") loadMyListingsRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to list item");
    } finally { setListingSubmitting(false); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <Shell>
      <div className="bm-container">
        <div className="bm-header">
          <h1 className="bm-title"><Icon name="market" size={26} className="icon-accent" /> Black Market</h1>
          <button className="bm-list-btn" onClick={() => setListingForm(true)}>
            <Icon name="plus" size={14} /> List Item
          </button>
        </div>

        <div className="bm-tabs">
          <button className={`bm-tab ${tab === "browse" ? "active" : ""}`} onClick={() => setTab("browse")}>
            <Icon name="market" size={14} /> Browse
          </button>
          <button className={`bm-tab ${tab === "my-listings" ? "active" : ""}`} onClick={() => { setTab("my-listings"); loadMyListingsRef.current(); }}>
            <Icon name="inventory" size={14} /> My Listings
          </button>
        </div>

        {tab === "browse" && (
          <>
            <div className="bm-filters">
              <input className="bm-search" type="text" placeholder="Search items..." value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              <select className="bm-category-select" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}>
                <option value="">All Categories</option>
                <option value="weapon">Weapons</option>
                <option value="armor">Armor</option>
                <option value="medical">Medical</option>
                <option value="drug">Drugs</option>
                <option value="material">Materials</option>
                <option value="other">Other</option>
              </select>
            </div>

            {loading ? (
              <div className="bm-skeleton"><Skeleton width={300} height={4} /></div>
            ) : error ? (
              <div className="bm-error" role="alert"><p>{error}</p><button className="bm-retry-btn" onClick={loadListings}>Retry</button></div>
            ) : listings.length === 0 ? (
              <p className="bm-empty">No listings found. Be the first to list something!</p>
            ) : (
              <>
                <div className="bm-grid">
                  {listings.map((l) => (
                    <div key={l.id} className="bm-card">
                      <div className="bm-card-top">
                        <span className="bm-item-name">{l.item_name}</span>
                        <span className="bm-item-category">{l.category}</span>
                      </div>
                      <div className="bm-card-body">
                        <div className="bm-card-row">
                          <span className="bm-card-label">Seller</span>
                          <span className="bm-card-value">{l.seller_username}</span>
                        </div>
                        <div className="bm-card-row">
                          <span className="bm-card-label">Qty Left</span>
                          <span className="bm-card-value">{l.quantity_left}/{l.quantity}</span>
                        </div>
                        <div className="bm-card-row">
                          <span className="bm-card-label">Price</span>
                          <span className="bm-card-value bm-price">{formatMoney(l.price_per_unit)}</span>
                        </div>
                        <div className="bm-card-row">
                          <span className="bm-card-label">Listed</span>
                          <span className="bm-card-value">{formatDate(l.listed_at)}</span>
                        </div>
                      </div>
                      <button
                        className="bm-buy-btn"
                        disabled={buying === l.id}
                        onClick={() => void handleBuy(l.id)}
                      >
                        {buying === l.id ? "Buying..." : "Buy"}
                      </button>
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="bm-pagination">
                    <button className="bm-page-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</button>
                    <span className="bm-page-info">Page {page} of {totalPages}</span>
                    <button className="bm-page-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "my-listings" && (
          <div className="bm-my-listings">
            {myListingsLoading ? (
              <div className="bm-skeleton"><Skeleton width={300} height={4} /></div>
            ) : myListings.length === 0 ? (
              <p className="bm-empty">You have no active listings.</p>
            ) : (
              <div className="bm-grid">
                {myListings.map((l) => (
                  <div key={l.id} className="bm-card bm-card-own">
                    <div className="bm-card-top">
                      <span className="bm-item-name">{l.item_name}</span>
                      <span className="bm-item-category">{l.category}</span>
                    </div>
                    <div className="bm-card-body">
                      <div className="bm-card-row">
                        <span className="bm-card-label">Qty Left</span>
                        <span className="bm-card-value">{l.quantity_left}/{l.quantity}</span>
                      </div>
                      <div className="bm-card-row">
                        <span className="bm-card-label">Price</span>
                        <span className="bm-card-value bm-price">{formatMoney(l.price_per_unit)}</span>
                      </div>
                    </div>
                    <button
                      className="bm-cancel-btn"
                      disabled={cancelling === l.id}
                      onClick={() => void handleCancel(l.id)}
                    >
                      {cancelling === l.id ? "Cancelling..." : "Cancel"}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={listingForm} onClose={() => { if (!listingSubmitting) setListingForm(false); }} title="List Item on Market" titleId="list-item-title">
        <div className="bm-list-form">
          <div className="bm-input-group">
            <label className="bm-label">Item ID</label>
            <input className="bm-input" type="number" min="1" placeholder="Enter item ID" value={listItemId} onChange={(e) => setListItemId(e.target.value)} />
          </div>
          <div className="bm-input-group">
            <label className="bm-label">Quantity</label>
            <input className="bm-input" type="number" min="1" value={listQty} onChange={(e) => setListQty(e.target.value)} />
          </div>
          <div className="bm-input-group">
            <label className="bm-label">Price per Unit ($)</label>
            <input className="bm-input" type="number" min="1" placeholder="1000" value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
          </div>
          <button className="bm-submit-btn" disabled={listingSubmitting || !listItemId || !listPrice} onClick={() => void handleList()}>
            {listingSubmitting ? "Listing..." : "List for Sale"}
          </button>
        </div>
      </Modal>
    </Shell>
  );
}
