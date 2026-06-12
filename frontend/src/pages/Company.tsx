import Shell from "../components/Shell";
import Icon from "../components/ui/Icon";
import "../styles/Company.css";

export default function Company() {
  return (
    <Shell>
      <div className="company-container">
        <div className="company-card">
          <div className="company-icon">
            <Icon name="company" size={48} className="icon-accent" />
          </div>
          <span className="company-badge">COMING SOON</span>
          <h1 className="company-title">Company System</h1>
          <p className="company-tagline">
            Build and manage your own criminal enterprise. Hire crew members,
            assign them to operations, and rake in passive income.
          </p>

          <div className="company-features">
            <div className="company-feature">
              <Icon name="check" size={16} className="icon-success" />
              <span>Recruit and manage crew members</span>
            </div>
            <div className="company-feature">
              <Icon name="check" size={16} className="icon-success" />
              <span>Assign operations for passive income</span>
            </div>
            <div className="company-feature">
              <Icon name="check" size={16} className="icon-success" />
              <span>Upgrade your hideout and equipment</span>
            </div>
            <div className="company-feature">
              <Icon name="check" size={16} className="icon-success" />
              <span>Compete for territory with other crews</span>
            </div>
          </div>

          <div className="company-bar-wrapper">
            <div className="company-bar-track">
              <div className="company-bar-fill" />
            </div>
            <span className="company-bar-label">In Development</span>
          </div>
        </div>
      </div>
    </Shell>
  );
}
