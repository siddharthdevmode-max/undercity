import Icon from "./ui/Icon";

interface DebtBannerProps {
  money: number;
}

export default function DebtBanner({ money }: DebtBannerProps) {
  if (money >= 0) return null;

  return (
    <div className="debt-banner" role="alert">
      <Icon name="warning" size={16} className="debt-banner-icon" />
      <span className="debt-banner-text">
        You are in debt (${Math.abs(money).toLocaleString()}). 
        You cannot use the market or send transfers until your balance is positive.
      </span>
    </div>
  );
}
