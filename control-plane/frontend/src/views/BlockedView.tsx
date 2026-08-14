export default function BlockedView({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="status-screen">
      <div className="status-card">
        <div className="status-icon blocked">⛔</div>
        <h1>Acesso bloqueado</h1>
        <p>Sua conta foi bloqueada por um administrador. Entre em contato se acredita que isso é um engano.</p>
        <button className="status-logout-btn" onClick={onLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
