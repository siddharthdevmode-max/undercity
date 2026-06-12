import { useState } from "react";
import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import { toast } from "../utils/toast";
import "../styles/StockMarket.css";

interface Stock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  shares: number;
}

const STOCKS: Stock[] = [
  { symbol: "UCB", name: "Undercity Bank", price: 47.82, change: 2.3, shares: 14 },
  { symbol: "ARN", name: "ArmorTech Industries", price: 123.45, change: -0.8, shares: 0 },
  { symbol: "MDC", name: "Medical Corps", price: 89.17, change: 1.2, shares: 5 },
  { symbol: "SLM", name: "ShadowLeaf Mining", price: 34.56, change: -3.4, shares: 0 },
  { symbol: "BTC", name: "Blackwood Trading Co", price: 215.00, change: 5.6, shares: 8 },
  { symbol: "NMR", name: "NightMarket Retail", price: 12.34, change: 0.0, shares: 0 },
  { symbol: "STL", name: "SteelForge Arms", price: 76.89, change: -1.1, shares: 0 },
  { symbol: "HLT", name: "HollowPoint Logistics", price: 158.23, change: 3.2, shares: 3 },
];

export default function StockMarket() {
  const [selected, setSelected] = useState<Stock | null>(null);
  const [buyShares, setBuyShares] = useState("10");
  const portfolio = STOCKS.filter((s) => s.shares > 0);

  const handleBuy = () => {
    if (!selected) return;
    const qty = parseInt(buyShares, 10);
    if (isNaN(qty) || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    toast.success(`Bought ${qty} shares of ${selected.symbol}`);
  };

  const handleSell = (stock: Stock) => {
    toast.success(`Sold ${stock.shares} shares of ${stock.symbol}`);
  };

  return (
    <Shell>
      <div className="stock-market-container">
        <div className="stock-market-header">
          <h1 className="stock-market-title"><Icon name="stocks" size={26} className="icon-accent" /> Stock Market</h1>
          <p className="stock-market-desc">Trade shares of Undercity's most powerful corporations.</p>
        </div>

        <div className="stock-market-grid">
          <div className="stock-list-section">
            <h2 className="stock-section-title">All Stocks</h2>
            <div className="stock-table">
              <div className="stock-table-header">
                <span className="stock-col stock-col-sym">Symbol</span>
                <span className="stock-col stock-col-name">Company</span>
                <span className="stock-col stock-col-price">Price</span>
                <span className="stock-col stock-col-chg">Change</span>
                <span className="stock-col stock-col-action"></span>
              </div>
              {STOCKS.map((stock) => (
                <div key={stock.symbol} className={`stock-row ${selected?.symbol === stock.symbol ? "stock-row-selected" : ""}`}>
                  <span className="stock-col stock-col-sym stock-sym">{stock.symbol}</span>
                  <span className="stock-col stock-col-name stock-name">{stock.name}</span>
                  <span className="stock-col stock-col-price stock-price">${stock.price.toFixed(2)}</span>
                  <span className={`stock-col stock-col-chg ${stock.change >= 0 ? "stock-chg-pos" : "stock-chg-neg"}`}>
                    {stock.change >= 0 ? "+" : ""}{stock.change.toFixed(1)}%
                  </span>
                  <span className="stock-col stock-col-action">
                    <button className="stock-trade-btn" onClick={() => setSelected(stock)}>Trade</button>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="stock-sidebar">
            {selected ? (
              <div className="stock-trade-panel">
                <h3 className="stock-panel-title">Trade {selected.symbol}</h3>
                <div className="stock-panel-info">
                  <div className="stock-panel-row">
                    <span>Current Price</span>
                    <span className="stock-price">${selected.price.toFixed(2)}</span>
                  </div>
                  <div className="stock-panel-row">
                    <span>Your Shares</span>
                    <span>{selected.shares}</span>
                  </div>
                  <div className="stock-panel-row">
                    <span>Estimated Cost</span>
                    <span>${(selected.price * (parseInt(buyShares, 10) || 0)).toFixed(2)}</span>
                  </div>
                </div>
                <div className="stock-buy-row">
                  <label className="stock-buy-label">Shares</label>
                  <input className="stock-buy-input" type="number" min="1" value={buyShares} onChange={(e) => setBuyShares(e.target.value)} />
                </div>
                <button className="stock-buy-btn" onClick={handleBuy}>Buy Shares</button>
                <button className="stock-cancel-btn" onClick={() => setSelected(null)}>Cancel</button>
              </div>
            ) : (
              <div className="stock-portfolio">
                <h3 className="stock-panel-title">Your Portfolio</h3>
                {portfolio.length === 0 ? (
                  <p className="stock-empty">No shares owned. Pick a stock to start trading.</p>
                ) : (
                  <>
                    {portfolio.map((stock) => (
                      <div key={stock.symbol} className="stock-portfolio-row">
                        <div className="stock-portfolio-left">
                          <span className="stock-sym">{stock.symbol}</span>
                          <span className="stock-portfolio-shares">{stock.shares} shares</span>
                        </div>
                        <div className="stock-portfolio-right">
                          <span className="stock-price">${(stock.price * stock.shares).toFixed(2)}</span>
                          <button className="stock-sell-btn" onClick={() => handleSell(stock)}>Sell</button>
                        </div>
                      </div>
                    ))}
                    <div className="stock-portfolio-total">
                      <span>Total Value</span>
                      <span>${portfolio.reduce((sum, s) => sum + s.price * s.shares, 0).toFixed(2)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Shell>
  );
}