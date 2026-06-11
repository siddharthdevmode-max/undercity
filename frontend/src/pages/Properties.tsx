import { useState, useEffect, useCallback, useRef } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/Skeleton";
import { propertiesAPI } from "../services/properties";
import type { Property, PropertiesResponse } from "../services/properties";
import { toast } from "../utils/toast";
import { userEvents } from "../utils/userEvents";
import "../styles/Properties.css";

export default function PropertiesPage() {
  const [data, setData] = useState<PropertiesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buying, setBuying] = useState<number | null>(null);

  const loadRef = useRef<() => void>(() => {});
  const load = useCallback(() => {
    setError(null); setLoading(true);
    propertiesAPI.list()
      .then(setData)
      .catch((err: unknown) => { const m = err instanceof Error ? err.message : "Failed to load"; setError(m); toast.error(m); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { loadRef.current(); }, []);

  const handleBuy = async (propertyId: number) => {
    setBuying(propertyId);
    try {
      const res = await propertiesAPI.buy(propertyId);
      toast.success(`Bought ${res.property.name}`);
      userEvents.emit({ money: res.money });
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Purchase failed");
    } finally { setBuying(null); }
  };

  const handleCollect = async () => {
    try {
      const res = await propertiesAPI.collect();
      toast.success(`Collected $${res.totalIncome.toLocaleString()}`);
      userEvents.emit({ money: res.money });
      loadRef.current();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Collection failed");
    }
  };

  if (loading) return <Shell><div className="props-container"><div className="props-header"><h1 className="props-title"><Icon name="properties" size={28} className="icon-accent" /> Properties</h1></div><Skeleton width={200} height={4} /></div></Shell>;
  if (error) return <Shell><div className="props-error" role="alert"><p>{error}</p><button className="props-retry-btn" onClick={load}>Retry</button></div></Shell>;

  return (
    <Shell>
      <div className="props-container">
        <div className="props-header">
          <h1 className="props-title"><Icon name="properties" size={26} className="icon-accent" /> Properties</h1>
          {data && data.owned.length > 0 && (
            <button className="props-collect-btn" onClick={() => void handleCollect()}>Collect Income</button>
          )}
        </div>

        {data && data.owned.length > 0 && (
          <div className="props-owned-info">
            <Icon name="check" size={16} className="icon-accent" />
            You own <strong>{data.owned.length}</strong> propert{data.owned.length === 1 ? "y" : "ies"}
          </div>
        )}

        <div className="props-grid">
          {data?.properties.map((prop: Property) => {
            const isOwned = data.owned.includes(prop.id);
            return (
              <div key={prop.id} className={`props-card ${!prop.unlocked ? "props-card-locked" : ""} ${isOwned ? "props-card-owned" : ""}`}>
                <div className="props-card-header">
                  <h3 className="props-name">{prop.name}</h3>
                  {isOwned && <span className="props-owned-badge">Owned</span>}
                </div>
                <p className="props-desc-text">{prop.description}</p>
                <div className="props-details">
                  <span>${prop.price.toLocaleString()}</span>
                  <span>${prop.daily_income.toLocaleString()}/day</span>
                  <span>Lvl {prop.min_level}</span>
                </div>
                {!isOwned && (
                  <button
                    className="props-buy-btn"
                    disabled={!prop.canAfford || !prop.unlocked || buying !== null}
                    onClick={() => void handleBuy(prop.id)}
                  >
                    {buying === prop.id ? "Buying..." : prop.canAfford && prop.unlocked ? "Buy" : prop.unlocked ? "Can't Afford" : "Locked"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Shell>
  );
}

