import Icon from "./Icon";

function StatCard({ title, value, description, icon = "activity", tone = "blue" }) {
  return (
    <article className={`stat-card stat-card-${tone}`}>
      <div className="stat-card-topline">
        <div className="stat-card-icon">
          <Icon name={icon} size={20} />
        </div>
        <span className="stat-card-label">Canlı veri</span>
      </div>

      <p className="stat-card-title">{title}</p>
      <h2>{value}</h2>
      <span className="stat-card-description">{description}</span>
    </article>
  );
}

export default StatCard;
