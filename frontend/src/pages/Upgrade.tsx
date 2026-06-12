import { useState, useEffect } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { paymentsAPI, type TierInfo } from "../services/payments";
import { toast } from "../utils/toast";
import "../styles/Upgrade.css";

export default function Upgrade() {
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [currentTier, setCurrentTier] = useState<string>("player");
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await paymentsAPI.getTiers();
        setTiers(data.tiers);
        setCurrentTier(data.current_tier ?? "player");
      } catch {
        toast.error("Failed to load tier info");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const handlePurchase = async (tier: string) => {
    setPurchasing(tier);
    try {
      const data = await paymentsAPI.getCheckoutUrl(tier as "citizen" | "contributor");
      window.open(data.url, "_blank", "noopener");
      toast.success("Checkout opened in new tab");
    } catch {
      toast.error("Checkout failed");
    } finally {
      setPurchasing(null);
    }
  };

  if (loading) {
    return (
      <Shell>
        <div className="upgrade-loading">
          <div className="upgrade-spinner" />
        </div>
      </Shell>
    );
  }

  const playerTier = tiers.find((t) => t.tier === "player");
  const paidTiers = tiers.filter((t) => t.tier !== "player");

  return (
    <Shell>
      <div className="upgrade-container">
        <div className="upgrade-header">
          <h1 className="upgrade-title">
            <Icon name="black-card" size={24} className="icon-accent" />
            Upgrade Your Account
          </h1>
          <p className="upgrade-subtitle">
            Support Undercity and unlock premium features. No pay-to-win — just a better experience.
          </p>
        </div>

        {playerTier && (
          <div className="upgrade-current">
            <span className="upgrade-current-label">Current Plan:</span>
            <span className="upgrade-current-value">{currentTier === "player" ? "Free (Player)" : currentTier}</span>
          </div>
        )}

        <div className="upgrade-tiers-grid">
          {paidTiers.map((tier) => {
            const owned = currentTier === tier.tier;
            return (
              <div key={tier.tier} className={`upgrade-card ${owned ? "owned" : ""}`}>
                <div className="upgrade-card-header">
                  <Icon
                    name={tier.tier === "citizen" ? "black-card" : "contributor"}
                    size={32}
                    className="icon-accent"
                  />
                  <h2 className="upgrade-card-title">{tier.label}</h2>
                  <div className="upgrade-card-price">
                    <span className="upgrade-price-amount">${tier.price}</span>
                    <span className="upgrade-price-period">
                      {tier.is_subscription ? "/month" : ` / ${tier.duration_days} days`}
                    </span>
                  </div>
                </div>

                <div className="upgrade-card-body">
                  <div className="upgrade-perks">
                    <div className="upgrade-perk">
                      <Icon name="nerve" size={14} className="icon-accent" />
                      <span>{tier.nerve_regen_rate}</span>
                    </div>
                    <div className="upgrade-perk">
                      <Icon name="energy" size={14} className="icon-accent" />
                      <span>{tier.energy_regen_rate}</span>
                    </div>
                  </div>

                  <ul className="upgrade-features">
                    {tier.features.map((f, i) => (
                      <li key={i} className="upgrade-feature-item">
                        <Icon name="check" size={14} className="icon-success" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="upgrade-card-footer">
                  {owned ? (
                    <div className="upgrade-owned-badge">✓ Active</div>
                  ) : (
                    <button
                      className="upgrade-btn"
                      onClick={() => void handlePurchase(tier.tier)}
                      disabled={purchasing === tier.tier}
                    >
                      {purchasing === tier.tier ? "Opening checkout..." : `Get ${tier.label}`}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="upgrade-note">
          <Icon name="shield" size={16} className="icon-accent" />
          <span>
            All purchases are processed securely via Lemon Squeezy. Refunds available within 14 days.
          </span>
        </div>
      </div>
    </Shell>
  );
}