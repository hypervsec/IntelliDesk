function StatCard({ title, value, description }) {
  return (
    <div className="stat-card">
      <p className="stat-card-title">{title}</p>
      <h2>{value}</h2>
      <span>{description}</span>
    </div>
  );
}

export default StatCard;
